import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { KpiType } from "@src/generated/prisma/client";
import { kpiService } from "@/backend/services/kpi.service";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { withValidation } from "@/backend/middleware/with-validation";
import { requirePermission } from "@/backend/helpers/get-admin-caller";
import { PERMISSIONS } from "@/lib/permissions";

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: z.nativeEnum(KpiType).optional(),
});

type Params = { params: Promise<{ id: string }> };
type UpdateBody = z.infer<typeof updateSchema>;

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const caller = await requirePermission(PERMISSIONS.KPI_VIEW_ALL);
    if (caller instanceof NextResponse) return caller;

    const { id } = await params;
    return NextResponse.json(ok(await kpiService.getDefinitionById(id)));
  } catch (e) {
    return handleError(e);
  }
}

export const PUT = withValidation(updateSchema)(
  async (_req: NextRequest, ctx: Params & { body: UpdateBody }) => {
    try {
      const caller = await requirePermission(PERMISSIONS.KPI_MANAGE);
      if (caller instanceof NextResponse) return caller;

      const { id } = await ctx.params;
      const updated = await kpiService.updateDefinition(id, ctx.body);
      return NextResponse.json(ok(updated, "Definisi KPI berhasil diperbarui"));
    } catch (e) {
      return handleError(e);
    }
  }
);

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const caller = await requirePermission(PERMISSIONS.KPI_MANAGE);
    if (caller instanceof NextResponse) return caller;

    const { id } = await params;
    await kpiService.deleteDefinition(id);
    return NextResponse.json(ok(null, "Definisi KPI berhasil dihapus"));
  } catch (e) {
    return handleError(e);
  }
}
