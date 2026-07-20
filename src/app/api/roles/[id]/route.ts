import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { roleService } from "@/backend/services/role.service";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { withValidation } from "@/backend/middleware/with-validation";
import { requirePermission } from "@/backend/helpers/get-admin-caller";
import { PERMISSIONS, PermissionValues } from "@/lib/permissions";
import { ForbiddenError } from "@/backend/errors/app-error";

const updateRoleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  companyId: z.string().min(1).optional().nullable(),
  permissions: z.array(z.enum(PermissionValues)).optional(),
  payrollCompanyIds: z.array(z.string()).optional(),
});

type UpdateBody = z.infer<typeof updateRoleSchema>;

const SYSTEM_ROLES = ["SUPER_ADMIN", "OWNER"];

async function assertOwnCompanyRole(callerRoleName: string, callerCompanyId: string | null, id: string) {
  if (SYSTEM_ROLES.includes(callerRoleName.toUpperCase())) return;
  const role = await roleService.getById(id);
  if (role.companyId !== callerCompanyId) {
    throw new ForbiddenError("Tidak punya akses ke role PT ini");
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await requirePermission(PERMISSIONS.ROLES_VIEW);
  if (caller instanceof NextResponse) return caller;

  try {
    const { id } = await params;
    await assertOwnCompanyRole(caller.roleName, caller.companyId, id);
    const role = await roleService.getById(id);
    return NextResponse.json(ok(role));
  } catch (e) {
    return handleError(e);
  }
}

export const PATCH = withValidation(updateRoleSchema)(
  async (_req: NextRequest, ctx: { body: UpdateBody; params: Promise<{ id: string }> }) => {
    const caller = await requirePermission(PERMISSIONS.ROLES_MANAGE);
    if (caller instanceof NextResponse) return caller;

    try {
      const { id } = await ctx.params;
      await assertOwnCompanyRole(caller.roleName, caller.companyId, id);
      const isSystem = SYSTEM_ROLES.includes(caller.roleName.toUpperCase());
      const body = isSystem ? ctx.body : { ...ctx.body, companyId: caller.companyId };
      const role = await roleService.update(id, body);
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
  const caller = await requirePermission(PERMISSIONS.ROLES_MANAGE);
  if (caller instanceof NextResponse) return caller;

  try {
    const { id } = await params;
    await assertOwnCompanyRole(caller.roleName, caller.companyId, id);
    await roleService.delete(id);
    return NextResponse.json(ok(null, "Role deleted"));
  } catch (e) {
    return handleError(e);
  }
}
