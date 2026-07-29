import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { kpiService } from "@/backend/services/kpi.service";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { withValidation } from "@/backend/middleware/with-validation";
import { requirePermission } from "@/backend/helpers/get-admin-caller";
import { assertCompanyAccess } from "@/backend/services/stockist.service";
import { PERMISSIONS } from "@/lib/permissions";
import { roleKpiScoringSchema } from "../route";

const updateSchema = z.object(roleKpiScoringSchema).partial();

type Params = { params: Promise<{ id: string }> };
type UpdateBody = z.infer<typeof updateSchema>;

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const caller = await requirePermission(PERMISSIONS.KPI_VIEW_ALL);
    if (caller instanceof NextResponse) return caller;

    const { id } = await params;
    const roleKpi = await kpiService.getRoleKpiById(id);
    assertCompanyAccess(caller, roleKpi.companyId);
    return NextResponse.json(ok(roleKpi));
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
      // Cek PT sebelum menulis: tanpa ini pemegang KPI_MANAGE di satu PT bisa
      // mengubah konfigurasi PT lain hanya dengan menebak id-nya.
      const existing = await kpiService.getRoleKpiById(id);
      assertCompanyAccess(caller, existing.companyId);

      const updated = await kpiService.updateRoleKpi(id, ctx.body);
      return NextResponse.json(ok(updated, "Konfigurasi KPI jabatan berhasil diperbarui"));
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
    const existing = await kpiService.getRoleKpiById(id);
    assertCompanyAccess(caller, existing.companyId);

    await kpiService.deleteRoleKpi(id);
    return NextResponse.json(ok(null, "Konfigurasi KPI jabatan berhasil dihapus"));
  } catch (e) {
    return handleError(e);
  }
}
