import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { userService } from "@/backend/services/user.service";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { withValidation } from "@/backend/middleware/with-validation";
import { getAdminCaller, type AdminCaller } from "@/backend/helpers/get-admin-caller";
import { isGlobalRole } from "@/lib/permissions";

/**
 * For a company-scoped caller (Kepala Cabang), verifies the target user belongs
 * to the caller's PT. Returns null when allowed, or a 403/404 NextResponse.
 * Global roles (Super Admin/Owner) are never restricted.
 */
async function assertSamePt(caller: AdminCaller, targetUserId: string): Promise<NextResponse | null> {
  if (isGlobalRole(caller.roleName)) return null;
  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { branch: { select: { companyId: true } } },
  });
  if (!target) {
    return NextResponse.json({ error: "Pengguna tidak ditemukan" }, { status: 404 });
  }
  if (target.branch?.companyId !== caller.companyId) {
    return NextResponse.json({ error: "Pengguna berada di luar PT Anda" }, { status: 403 });
  }
  return null;
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
  try {
    const caller = await getAdminCaller();
    if (caller instanceof NextResponse) return caller;

    const { id } = await params;
    const scopeError = await assertSamePt(caller, id);
    if (scopeError) return scopeError;

    const user = await userService.getById(id);
    return NextResponse.json(ok(user));
  } catch (e) {
    return handleError(e);
  }
}

export const PUT = withValidation(updateUserSchema)(
  async (_req: NextRequest, ctx: Params & { body: UpdateBody }) => {
    try {
      const caller = await getAdminCaller();
      if (caller instanceof NextResponse) return caller;

      const { id } = await ctx.params;
      const scopeError = await assertSamePt(caller, id);
      if (scopeError) return scopeError;

      const { joinDate, ...rest } = ctx.body;

      // Kepala Cabang tidak boleh memindahkan user ke cabang di luar PT-nya.
      if (rest.branchId && !isGlobalRole(caller.roleName)) {
        const branch = await prisma.branch.findUnique({
          where: { id: rest.branchId },
          select: { companyId: true },
        });
        if (!branch || branch.companyId !== caller.companyId) {
          return NextResponse.json({ error: "Cabang berada di luar PT Anda" }, { status: 403 });
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
  try {
    const caller = await getAdminCaller();
    if (caller instanceof NextResponse) return caller;

    const { id } = await params;
    const scopeError = await assertSamePt(caller, id);
    if (scopeError) return scopeError;

    await userService.delete(id);
    return NextResponse.json(ok(null, "Pengguna berhasil dihapus"));
  } catch (e) {
    return handleError(e);
  }
}
