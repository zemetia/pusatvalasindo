import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { branchService } from "@/backend/services/branch.service";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { withValidation } from "@/backend/middleware/with-validation";
import { requirePermission } from "@/backend/helpers/get-admin-caller";
import { PERMISSIONS } from "@/lib/permissions";

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
  try {
    const caller = await requirePermission(PERMISSIONS.BRANCHES_VIEW);
    if (caller instanceof NextResponse) return caller;

    const { id } = await params;
    const branch = await branchService.getById(id);
    return NextResponse.json(ok(branch));
  } catch (e) {
    return handleError(e);
  }
}

export const PUT = withValidation(updateBranchSchema)(
  async (_req: NextRequest, ctx: Params & { body: UpdateBody }) => {
    try {
      const caller = await requirePermission(PERMISSIONS.BRANCHES_MANAGE);
      if (caller instanceof NextResponse) return caller;

      const { id } = await ctx.params;
      const branch = await branchService.update(id, ctx.body);
      return NextResponse.json(ok(branch, "Branch updated"));
    } catch (e) {
      return handleError(e);
    }
  }
);

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const caller = await requirePermission(PERMISSIONS.BRANCHES_MANAGE);
    if (caller instanceof NextResponse) return caller;

    const { id } = await params;
    await branchService.delete(id);
    return NextResponse.json(ok(null, "Branch deleted"));
  } catch (e) {
    return handleError(e);
  }
}
