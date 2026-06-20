import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { roleService } from "@/backend/services/role.service";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { withValidation } from "@/backend/middleware/with-validation";

const updateRoleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  companyId: z.string().cuid().optional().nullable(),
  permissions: z.array(z.string()).optional(),
});

type UpdateBody = z.infer<typeof updateRoleSchema>;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const role = await roleService.getById(id);
    return NextResponse.json(ok(role));
  } catch (e) {
    return handleError(e);
  }
}

export const PATCH = withValidation(updateRoleSchema)(
  async (_req: NextRequest, ctx: { body: UpdateBody; params: Promise<{ id: string }> }) => {
    try {
      const { id } = await ctx.params;
      const role = await roleService.update(id, ctx.body);
      return NextResponse.json(ok(role, "Role updated"));
    } catch (e) {
      return handleError(e);
    }
  }
);

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await roleService.delete(id);
    return NextResponse.json(ok(null, "Role deleted"));
  } catch (e) {
    return handleError(e);
  }
}
