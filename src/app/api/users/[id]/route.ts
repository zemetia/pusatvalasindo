import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { userService } from "@/backend/services/user.service";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { withValidation } from "@/backend/middleware/with-validation";

const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  image: z.string().url().optional(),
  phone: z.string().max(20).optional(),
  customRoleId: z.string().optional().nullable(),
  branchId: z.string().min(1).optional().nullable(),
  baseSalary: z.number().positive().optional().nullable(),
  mealAllowance: z.number().positive().optional().nullable(),
  transportAllowance: z.number().positive().optional().nullable(),
  joinDate: z.string().optional(),
  isActive: z.boolean().optional(),
});

type Params = { params: Promise<{ id: string }> };
type UpdateBody = z.infer<typeof updateUserSchema>;

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const user = await userService.getById(id);
    return NextResponse.json(ok(user));
  } catch (e) {
    return handleError(e);
  }
}

export const PUT = withValidation(updateUserSchema)(
  async (_req: NextRequest, ctx: Params & { body: UpdateBody }) => {
    try {
      const { id } = await ctx.params;
      const { joinDate, ...rest } = ctx.body;
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
    const { id } = await params;
    await userService.delete(id);
    return NextResponse.json(ok(null, "Pengguna berhasil dihapus"));
  } catch (e) {
    return handleError(e);
  }
}
