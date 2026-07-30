import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { kpiService } from "@/backend/services/kpi.service";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { withValidation } from "@/backend/middleware/with-validation";
import { authorize } from "@/backend/helpers/authz";
import { roleKpiScoringSchema } from "../route";

const updateSchema = z.object(roleKpiScoringSchema).partial();

type Params = { params: Promise<{ id: string }> };
type UpdateBody = z.infer<typeof updateSchema>;

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const caller = await authorize("kpi.config", "view");
    if (caller instanceof NextResponse) return caller;

    const { id } = await params;
    const roleKpi = await kpiService.getRoleKpiById(id);
    return NextResponse.json(ok(roleKpi));
  } catch (e) {
    return handleError(e);
  }
}

export const PUT = withValidation(updateSchema)(
  async (_req: NextRequest, ctx: Params & { body: UpdateBody }) => {
    try {
      const caller = await authorize("kpi.config", "write");
      if (caller instanceof NextResponse) return caller;

      const { id } = await ctx.params;
      // Memastikan barisnya ada — melempar NotFoundError kalau tidak. Tidak ada
      // lagi cek per PT di sini: `kpi.config` bersifat global, bobot KPI dipakai
      // bersama seluruh PT.
      await kpiService.getRoleKpiById(id);

      const updated = await kpiService.updateRoleKpi(id, ctx.body);
      return NextResponse.json(ok(updated, "Konfigurasi KPI jabatan berhasil diperbarui"));
    } catch (e) {
      return handleError(e);
    }
  }
);

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const caller = await authorize("kpi.config", "write");
    if (caller instanceof NextResponse) return caller;

    const { id } = await params;
    await kpiService.getRoleKpiById(id);

    await kpiService.deleteRoleKpi(id);
    return NextResponse.json(ok(null, "Konfigurasi KPI jabatan berhasil dihapus"));
  } catch (e) {
    return handleError(e);
  }
}
