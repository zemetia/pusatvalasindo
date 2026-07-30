import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { branchService } from "@/backend/services/branch.service";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { withValidation } from "@/backend/middleware/with-validation";
import { authorize } from "@/backend/helpers/authz";

const updateBranchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  address: z.string().max(500).optional(),
  phone: z.string().max(20).optional(),
  companyId: z.string().min(1).optional().nullable(),
  isActive: z.boolean().optional(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  attendanceRadiusM: z.number().int().min(1).max(10000).optional().nullable(),
});

type Params = { params: Promise<{ id: string }> };
type UpdateBody = z.infer<typeof updateBranchSchema>;

export async function GET(_req: NextRequest, { params }: Params) {
  const authz = await authorize("branches", "view");
  if (authz instanceof NextResponse) return authz;

  try {
    const { id } = await params;
    const branch = await branchService.getById(id);
    authz.assertCompany(branch.companyId);
    return NextResponse.json(ok(branch));
  } catch (e) {
    return handleError(e);
  }
}

export const PUT = withValidation(updateBranchSchema)(
  async (_req: NextRequest, ctx: Params & { body: UpdateBody }) => {
    const authz = await authorize("branches", "write");
    if (authz instanceof NextResponse) return authz;

    try {
      const { id } = await ctx.params;
      const branch = await branchService.getById(id);
      // PT asal DAN PT tujuan sama-sama diuji — memindahkan cabang ke PT lain
      // sama saja dengan mengeluarkannya dari wewenang si pemanggil.
      authz.assertCompany(branch.companyId);
      if (ctx.body.companyId !== undefined) {
        authz.assertCompany(ctx.body.companyId ?? null);
      }

      const updated = await branchService.update(id, ctx.body);
      return NextResponse.json(ok(updated, "Branch updated"));
    } catch (e) {
      return handleError(e);
    }
  }
);

export async function DELETE(_req: NextRequest, { params }: Params) {
  const authz = await authorize("branches", "write");
  if (authz instanceof NextResponse) return authz;

  try {
    const { id } = await params;
    const branch = await branchService.getById(id);
    authz.assertCompany(branch.companyId);

    await branchService.delete(id);
    return NextResponse.json(ok(null, "Branch deleted"));
  } catch (e) {
    return handleError(e);
  }
}
