import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { companyService } from "@/backend/services/company.service";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { withValidation } from "@/backend/middleware/with-validation";
import { authorize } from "@/backend/helpers/authz";

const updateCompanySchema = z.object({
  name: z.string().min(1).max(120).optional(),
  code: z.string().min(1).max(20).optional(),
  isActive: z.boolean().optional(),
});

type Params = { params: Promise<{ id: string }> };
type UpdateBody = z.infer<typeof updateCompanySchema>;

export async function GET(_req: NextRequest, { params }: Params) {
  const authz = await authorize("companies", "view");
  if (authz instanceof NextResponse) return authz;

  try {
    const { id } = await params;
    return NextResponse.json(ok(await companyService.getById(id)));
  } catch (e) {
    return handleError(e);
  }
}

export const PUT = withValidation(updateCompanySchema)(
  async (_req: NextRequest, ctx: Params & { body: UpdateBody }) => {
    const authz = await authorize("companies", "write");
    if (authz instanceof NextResponse) return authz;

    try {
      const { id } = await ctx.params;
      const company = await companyService.update(id, ctx.body);
      return NextResponse.json(ok(company, "PT diperbarui"));
    } catch (e) {
      return handleError(e);
    }
  }
);

export async function DELETE(_req: NextRequest, { params }: Params) {
  const authz = await authorize("companies", "write");
  if (authz instanceof NextResponse) return authz;

  try {
    const { id } = await params;
    await companyService.delete(id);
    return NextResponse.json(ok(null, "PT dihapus"));
  } catch (e) {
    return handleError(e);
  }
}
