import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { kpiService } from "@/backend/services/kpi.service";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { withValidation } from "@/backend/middleware/with-validation";

const updateSchema = z.object({
  maxScore: z.number().positive().max(100).optional(),
  targetValue: z.number().positive().nullable().optional(),
  threshold: z.number().positive().nullable().optional(),
  weight: z.number().min(0).max(1).optional(),
});

type Params = { params: Promise<{ id: string }> };
type UpdateBody = z.infer<typeof updateSchema>;

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    return NextResponse.json(ok(await kpiService.getRoleKpiById(id)));
  } catch (e) {
    return handleError(e);
  }
}

export const PUT = withValidation(updateSchema)(
  async (_req: NextRequest, ctx: Params & { body: UpdateBody }) => {
    try {
      const { id } = await ctx.params;
      const updated = await kpiService.updateRoleKpi(id, ctx.body);
      return NextResponse.json(
        ok(updated, "Konfigurasi KPI jabatan berhasil diperbarui")
      );
    } catch (e) {
      return handleError(e);
    }
  }
);

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    await kpiService.deleteRoleKpi(id);
    return NextResponse.json(ok(null, "Konfigurasi KPI jabatan berhasil dihapus"));
  } catch (e) {
    return handleError(e);
  }
}
