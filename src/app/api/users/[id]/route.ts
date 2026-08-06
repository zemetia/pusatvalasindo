import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { userService } from "@/backend/services/user.service";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { withValidation } from "@/backend/middleware/with-validation";
import { authorize, type Authz } from "@/backend/helpers/authz";
import { ForbiddenError } from "@/backend/errors/app-error";
import { EMPLOYMENT_STATUSES, needsContractDates } from "@/lib/employment";

/**
 * Memastikan pengguna target berada dalam scope PT si pemanggil untuk aksi yang
 * diminta. PT seorang pengguna diturunkan dari cabangnya; pengguna tanpa cabang
 * tidak punya PT, jadi hanya pemegang scope seluruh PT yang bisa menyentuhnya.
 */
async function assertTargetInScope(authz: Authz, targetUserId: string) {
  const companyId = await userService.getCompanyOf(targetUserId);
  authz.assertCompany(companyId);
}

/** Tanggal polos `YYYY-MM-DD` — tanpa jam, tanpa zona. */
const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal harus berformat YYYY-MM-DD");

const updateUserSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    image: z.string().url().optional(),
    phone: z.string().max(20).optional(),
    customRoleId: z.string().optional().nullable(),
    branchId: z.string().min(1).optional().nullable(),
    baseSalary: z.number().positive().optional().nullable(),
    joinDate: z.string().optional(),
    isActive: z.boolean().optional(),
    employmentStatus: z.enum(EMPLOYMENT_STATUSES).optional(),
    contractStartDate: dateOnly.nullable().optional(),
    contractEndDate: dateOnly.nullable().optional(),
  })
  // Status ikatan kerja menentukan hak atas bonus (lihat `berkontrak` di
  // hv_employees), jadi kombinasi yang tidak masuk akal ditolak di sini — bukan
  // dibiarkan tersimpan lalu diam-diam mengubah nominal slip gaji.
  .superRefine((val, ctx) => {
    const status = val.employmentStatus;
    if (!status) {
      // Tanggal tanpa status akan menghasilkan pasangan yang tidak konsisten
      // (mis. tanggal berakhir dihapus pada karyawan PKWT ⇒ terbaca berkontrak
      // selamanya). Ketiganya wajib dikirim bersama.
      if (val.contractStartDate !== undefined || val.contractEndDate !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["employmentStatus"],
          message: "Tanggal kontrak hanya bisa diubah bersama status ikatan kerja",
        });
      }
      return;
    }

    if (!needsContractDates(status)) return;

    if (!val.contractStartDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["contractStartDate"],
        message: "Tanggal mulai kontrak wajib diisi untuk status ini",
      });
    }
    // PKWT tanpa tanggal berakhir terbaca sebagai kontrak tak berbatas waktu
    // oleh hv_employees — bonusnya tidak akan pernah berhenti sendiri. PKWTT
    // memang begitu; PKWT tidak boleh.
    if (status === "PKWT" && !val.contractEndDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["contractEndDate"],
        message: "PKWT wajib punya tanggal berakhir",
      });
    }
    if (
      val.contractStartDate &&
      val.contractEndDate &&
      val.contractEndDate < val.contractStartDate
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["contractEndDate"],
        message: "Tanggal berakhir tidak boleh mendahului tanggal mulai",
      });
    }
  });

/**
 * Tanggal polos disimpan sebagai tengah malam UTC, sama seperti `joinDate`.
 * Kolomnya `TIMESTAMP(3)` dan view membacanya dengan `::date`, jadi menulis
 * tengah malam waktu lokal server bisa menggeser tanggalnya satu hari.
 */
function toUtcDate(value: string | null | undefined): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

type Params = { params: Promise<{ id: string }> };
type UpdateBody = z.infer<typeof updateUserSchema>;

export async function GET(_req: NextRequest, { params }: Params) {
  const authz = await authorize("users", "view");
  if (authz instanceof NextResponse) return authz;

  try {
    const { id } = await params;
    await assertTargetInScope(authz, id);

    const user = await userService.getById(id);
    return NextResponse.json(ok(user));
  } catch (e) {
    return handleError(e);
  }
}

export const PUT = withValidation(updateUserSchema)(
  async (_req: NextRequest, ctx: Params & { body: UpdateBody }) => {
    const authz = await authorize("users", "write");
    if (authz instanceof NextResponse) return authz;

    try {
      const { id } = await ctx.params;
      await assertTargetInScope(authz, id);

      const { joinDate, employmentStatus, contractStartDate, contractEndDate, ...rest } =
        ctx.body;

      // Memindahkan pengguna ke cabang di luar scope sama saja dengan
      // memindahkannya keluar dari wewenang si pemanggil — PT tujuan ikut diuji.
      if (rest.branchId) {
        const branch = await prisma.branch.findUnique({
          where: { id: rest.branchId },
          select: { companyId: true },
        });
        if (!branch || !authz.canWrite(branch.companyId)) {
          throw new ForbiddenError("Cabang berada di luar wewenang Anda");
        }
      }

      // Jabatan yang ditetapkan juga harus berada dalam scope. Tanpa ini,
      // pemegang wewenang satu PT bisa menaikkan siapa pun ke jabatan sistem
      // (companyId null, mis. Super Admin) — eskalasi lewat pintu belakang.
      if (rest.customRoleId) {
        const role = await prisma.custom_role.findUnique({
          where: { id: rest.customRoleId },
          select: { companyId: true },
        });
        if (!role || !authz.canWrite(role.companyId)) {
          throw new ForbiddenError("Jabatan berada di luar wewenang Anda");
        }
      }

      // Status tanpa kontrak tidak boleh menyisakan tanggal lama — kalau
      // tersisa, layar HR menampilkan masa kontrak untuk orang yang justru
      // sedang tidak berkontrak.
      const contract = employmentStatus
        ? needsContractDates(employmentStatus)
          ? {
              employmentStatus,
              contractStartDate: toUtcDate(contractStartDate),
              contractEndDate: toUtcDate(contractEndDate),
            }
          : { employmentStatus, contractStartDate: null, contractEndDate: null }
        : {};

      const updated = await userService.update(id, {
        ...rest,
        ...contract,
        joinDate: joinDate ? new Date(joinDate) : undefined,
      });
      return NextResponse.json(ok(updated, "Pengguna berhasil diperbarui"));
    } catch (e) {
      return handleError(e);
    }
  }
);

export async function DELETE(_req: NextRequest, { params }: Params) {
  const authz = await authorize("users", "write");
  if (authz instanceof NextResponse) return authz;

  try {
    const { id } = await params;
    await assertTargetInScope(authz, id);

    await userService.delete(id);
    return NextResponse.json(ok(null, "Pengguna berhasil dihapus"));
  } catch (e) {
    return handleError(e);
  }
}
