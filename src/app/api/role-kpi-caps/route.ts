import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { kpiService } from "@/backend/services/kpi.service";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { withValidation } from "@/backend/middleware/with-validation";
import { authorize } from "@/backend/helpers/authz";
import { ValidationError } from "@/backend/errors/app-error";

/**
 * Plafon skor total (gabungan seluruh KPI tertimbang) satu jabatan di satu
 * PT. `maxTotalScore` null menghapus plafon — lihat RoleKpiCap di
 * prisma/schema/kpi.prisma.
 */
const setSchema = z.object({
  companyId: z.string().min(1),
  customRoleId: z.string().min(1),
  maxTotalScore: z.number().positive().nullable(),
});

type SetBody = z.infer<typeof setSchema>;

export async function GET(req: NextRequest) {
  const caller = await authorize("kpi.config", "view");
  if (caller instanceof NextResponse) return caller;

  try {
    const companyId = req.nextUrl.searchParams.get("companyId");
    const customRoleId = req.nextUrl.searchParams.get("customRoleId");
    if (!companyId || !customRoleId) {
      throw new ValidationError("companyId dan customRoleId wajib diisi");
    }

    const cap = await kpiService.getRoleKpiCap(companyId, customRoleId);
    return NextResponse.json(ok(cap));
  } catch (e) {
    return handleError(e);
  }
}

export const PUT = withValidation(setSchema)(
  async (_req: NextRequest, ctx: { body: SetBody }) => {
    const caller = await authorize("kpi.config", "write");
    if (caller instanceof NextResponse) return caller;

    try {
      const { companyId, customRoleId, maxTotalScore } = ctx.body;
      const cap = await kpiService.setRoleKpiCap(companyId, customRoleId, maxTotalScore);
      return NextResponse.json(
        ok(cap, maxTotalScore === null ? "Plafon skor total dihapus" : "Plafon skor total disimpan")
      );
    } catch (e) {
      return handleError(e);
    }
  }
);
