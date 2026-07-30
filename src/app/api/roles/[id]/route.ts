import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { roleService } from "@/backend/services/role.service";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { withValidation } from "@/backend/middleware/with-validation";
import { authorize, grantableCompanyIds } from "@/backend/helpers/authz";
import { PermissionValues } from "@/lib/permissions";

const updateRoleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  companyId: z.string().min(1).optional().nullable(),
  permissions: z.array(z.enum(PermissionValues)).optional(),
  payrollCompanyIds: z.array(z.string()).optional(),
});

type UpdateBody = z.infer<typeof updateRoleSchema>;

// `roles` bersifat global: siapa pun yang berhak mengelola jabatan, berhak atas
// jabatan seluruh PT — tidak ada lagi penyempitan "hanya jabatan PT saya".
// Batas eskalasi lintas PT ditegakkan di tempat izin benar-benar diberikan,
// yaitu PUT /api/roles/[id]/permissions.

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authz = await authorize("roles", "view");
  if (authz instanceof NextResponse) return authz;

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
    const authz = await authorize("roles", "write");
    if (authz instanceof NextResponse) return authz;

    try {
      const { id } = await ctx.params;
      const role = await roleService.update(id, ctx.body, grantableCompanyIds(authz));
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
  const authz = await authorize("roles", "write");
  if (authz instanceof NextResponse) return authz;

  try {
    const { id } = await params;
    await roleService.delete(id, grantableCompanyIds(authz));
    return NextResponse.json(ok(null, "Role deleted"));
  } catch (e) {
    return handleError(e);
  }
}
