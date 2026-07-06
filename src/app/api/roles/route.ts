import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { roleService } from "@/backend/services/role.service";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { withValidation } from "@/backend/middleware/with-validation";

const createRoleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  companyId: z.string().min(1).optional().nullable(),
  permissions: z.array(z.string()),
});

type CreateBody = z.infer<typeof createRoleSchema>;

export async function GET(req: NextRequest) {
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
    try {
      const role = await roleService.create(ctx.body);
      return NextResponse.json(ok(role, "Role created"), { status: 201 });
    } catch (e) {
      return handleError(e);
    }
  }
);
