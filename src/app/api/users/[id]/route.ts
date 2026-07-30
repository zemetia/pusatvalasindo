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

/**
 * Memastikan pengguna target berada dalam scope PT si pemanggil untuk aksi yang
 * diminta. PT seorang pengguna diturunkan dari cabangnya; pengguna tanpa cabang
 * tidak punya PT, jadi hanya pemegang scope seluruh PT yang bisa menyentuhnya.
 */
async function assertTargetInScope(authz: Authz, targetUserId: string) {
  const companyId = await userService.getCompanyOf(targetUserId);
  authz.assertCompany(companyId);
}

const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  image: z.string().url().optional(),
  phone: z.string().max(20).optional(),
  customRoleId: z.string().optional().nullable(),
  branchId: z.string().min(1).optional().nullable(),
  baseSalary: z.number().positive().optional().nullable(),
  mealAllowance: z.number().positive().optional().nullable(),
  transportAllowance: z.number().positive().optional().nullable(),
  positionAllowance: z.number().positive().optional().nullable(),
  bpjsKesehatan: z.number().positive().optional().nullable(),
  joinDate: z.string().optional(),
  isActive: z.boolean().optional(),
});

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

      const { joinDate, ...rest } = ctx.body;

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

      const updated = await userService.update(id, {
        ...rest,
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
