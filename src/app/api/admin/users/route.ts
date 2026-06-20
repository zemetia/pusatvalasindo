import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { withValidation } from "@/backend/middleware/with-validation";
import { getAdminCaller } from "@/backend/helpers/get-admin-caller";

const createUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).optional(),
  customRoleId: z.string().optional(),
  branchId: z.string().min(1),
  phone: z.string().max(20).optional(),
  baseSalary: z.number().positive().optional(),
  mealAllowance: z.number().positive().optional(),
  transportAllowance: z.number().positive().optional(),
  joinDate: z.string().optional(),
});

type CreateBody = z.infer<typeof createUserSchema>;

export const POST = withValidation(createUserSchema)(
  async (_req: NextRequest, ctx: { body: CreateBody }) => {
    try {
      const caller = await getAdminCaller();
      if (caller instanceof NextResponse) return caller;

      let { name, email, password, customRoleId, branchId, phone, baseSalary, mealAllowance, transportAllowance, joinDate } = ctx.body;

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
          mealAllowance: mealAllowance ?? null,
          transportAllowance: transportAllowance ?? null,
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
