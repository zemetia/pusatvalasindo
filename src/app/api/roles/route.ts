import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { roleService } from "@/backend/services/role.service";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { withValidation } from "@/backend/middleware/with-validation";
import { requirePermission } from "@/backend/helpers/get-admin-caller";
import { PERMISSIONS, PermissionValues } from "@/lib/permissions";

const createRoleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  companyId: z.string().min(1).optional().nullable(),
  permissions: z.array(z.enum(PermissionValues)),
  payrollCompanyIds: z.array(z.string()).optional(),
});

type CreateBody = z.infer<typeof createRoleSchema>;

const SYSTEM_ROLES = ["SUPER_ADMIN", "OWNER"];

export async function GET(req: NextRequest) {
  const caller = await requirePermission(PERMISSIONS.ROLES_VIEW);
  if (caller instanceof NextResponse) return caller;

  try {
    let companyId = req.nextUrl.searchParams.get("companyId");
    // Non-system callers can only ever see roles for their own company.
    if (!SYSTEM_ROLES.includes(caller.roleName.toUpperCase())) {
      companyId = caller.companyId;
    }
    const roles = companyId
      ? await roleService.getByCompany(companyId)
      : await roleService.getAll();
    return NextResponse.json(ok(roles));
  } catch (e) {
    return handleError(e);
  }
}

export const POST = withValidation(createRoleSchema)(
  async (_req: NextRequest, ctx: { body: CreateBody }) => {
    const caller = await requirePermission(PERMISSIONS.ROLES_MANAGE);
    if (caller instanceof NextResponse) return caller;

    try {
      const isSystem = SYSTEM_ROLES.includes(caller.roleName.toUpperCase());
      const companyId = isSystem ? (ctx.body.companyId ?? null) : caller.companyId;
      const role = await roleService.create({ ...ctx.body, companyId });
      return NextResponse.json(ok(role, "Role created"), { status: 201 });
    } catch (e) {
      return handleError(e);
    }
  }
);
