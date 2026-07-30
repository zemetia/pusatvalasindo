import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { roleService } from "@/backend/services/role.service";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { withValidation } from "@/backend/middleware/with-validation";
import { authorize, grantableCompanyIds } from "@/backend/helpers/authz";
import { PermissionValues } from "@/lib/permissions";

const createRoleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  companyId: z.string().min(1).optional().nullable(),
  permissions: z.array(z.enum(PermissionValues)),
  payrollCompanyIds: z.array(z.string()).optional(),
});

type CreateBody = z.infer<typeof createRoleSchema>;

export async function GET(req: NextRequest) {
  // `roles` adalah resource global (lihat lib/authz/resources.ts): jabatan
  // dikelola sebagai satu sistem lintas PT, jadi tidak ada penyempitan per PT
  // di sini — yang ada hanya punya akses atau tidak.
  const authz = await authorize("roles", "view");
  if (authz instanceof NextResponse) return authz;

  try {
    const companyId = req.nextUrl.searchParams.get("companyId");
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
    const authz = await authorize("roles", "write");
    if (authz instanceof NextResponse) return authz;

    try {
      // Batas eskalasi yang sama dengan PUT /api/roles/[id]/permissions: nama
      // jabatan global dan PT di luar wewenang ditolak di sini.
      const role = await roleService.create(
        { ...ctx.body, companyId: ctx.body.companyId ?? null },
        grantableCompanyIds(authz)
      );
      return NextResponse.json(ok(role, "Role created"), { status: 201 });
    } catch (e) {
      return handleError(e);
    }
  }
);
