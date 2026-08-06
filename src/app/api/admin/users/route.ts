import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { withValidation } from "@/backend/middleware/with-validation";
import { authorize } from "@/backend/helpers/authz";
import { ForbiddenError } from "@/backend/errors/app-error";

const createUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).optional(),
  customRoleId: z.string().optional(),
  branchId: z.string().min(1),
  phone: z.string().max(20).optional(),
  baseSalary: z.number().positive().optional(),
  joinDate: z.string().optional(),
});

type CreateBody = z.infer<typeof createUserSchema>;

export const POST = withValidation(createUserSchema)(
  async (_req: NextRequest, ctx: { body: CreateBody }) => {
    try {
      const authz = await authorize("users", "write");
      if (authz instanceof NextResponse) return authz;

      let { name, email, password, customRoleId, branchId, phone, baseSalary, joinDate } = ctx.body;

      // Pengguna baru lahir di sebuah cabang, dan cabang itulah yang menentukan
      // PT-nya — jadi PT tujuan harus berada dalam scope tulis si pemanggil.
      const branch = await prisma.branch.findUnique({
        where: { id: branchId },
        select: { companyId: true },
      });
      if (!branch || !authz.canWrite(branch.companyId)) {
        throw new ForbiddenError("Cabang berada di luar wewenang Anda");
      }

      // Jabatan yang diberikan juga harus dalam scope: tanpa ini, pemegang
      // wewenang satu PT bisa langsung membuat akun berjabatan sistem
      // (companyId null, mis. Super Admin).
      if (customRoleId) {
        const role = await prisma.custom_role.findUnique({
          where: { id: customRoleId },
          select: { companyId: true },
        });
        if (!role || !authz.canWrite(role.companyId)) {
          throw new ForbiddenError("Jabatan berada di luar wewenang Anda");
        }
      }

      if (!password) {
        const emailPrefix = email.split("@")[0];
        const dateObj = new Date();
        const dd = String(dateObj.getDate()).padStart(2, "0");
        const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
        const yy = String(dateObj.getFullYear()).slice(-2);
        password = `${emailPrefix}${dd}${mm}${yy}`;
      }

      const result = await auth.api.signUpEmail({
        body: { name, email, password },
      });

      const userId = (result as { user?: { id: string } })?.user?.id;
      if (!userId) {
        return NextResponse.json({ error: "Gagal membuat akun" }, { status: 500 });
      }

      const user = await prisma.user.update({
        where: { id: userId },
        data: {
          customRoleId: customRoleId || null,
          branchId,
          phone: phone ?? null,
          baseSalary: baseSalary ?? null,
          joinDate: joinDate ? new Date(joinDate) : new Date(),
          emailVerified: true,
          updatedAt: new Date(),
        },
        select: {
          id: true,
          name: true,
          email: true,
          customRoleId: true,
          branchId: true,
          phone: true,
          isActive: true,
          joinDate: true,
        },
      });

      return NextResponse.json(ok(user, "Pengguna berhasil dibuat"), { status: 201 });
    } catch (e: unknown) {
      if (e instanceof Error && e.message.toLowerCase().includes("already")) {
        return NextResponse.json({ error: "Email sudah terdaftar" }, { status: 409 });
      }
      return handleError(e);
    }
  }
);
