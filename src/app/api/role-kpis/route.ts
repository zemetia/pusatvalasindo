import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { kpiService } from "@/backend/services/kpi.service";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { withValidation } from "@/backend/middleware/with-validation";
import { requirePermission } from "@/backend/helpers/get-admin-caller";
import { assertCompanyAccess } from "@/backend/services/stockist.service";
import { PERMISSIONS } from "@/lib/permissions";

/**
 * Parameter penilaian. Mana yang wajib diisi tergantung scoringType definisinya
 * — validasinya ada di UI karena admin bisa menyimpan konfigurasi bertahap;
 * engine memperlakukan parameter yang belum disetel sebagai "belum bisa dinilai"
 * dan bukan sebagai nol diam-diam (lihat src/lib/kpi-scoring.ts).
 */
export const roleKpiScoringSchema = {
  weight: z.number().min(0).max(1),
  targetValue: z.number().nullish(),
  basePoint: z.number().positive().nullish(),
  pointPerUnit: z.number().nullish(),
  toleranceLimit: z.number().nullish(),
  toleranceScope: z.enum(["DAILY", "WEEKLY", "MONTHLY"]).nullish(),
  maxAchievement: z.number().min(1).max(3).optional(),
  minAchievement: z.number().min(0).max(1).optional(),
  inputSource: z.enum(["SELF", "SUPERVISOR", "SYSTEM"]).nullish(),
  requiresApproval: z.boolean().nullish(),
  requiresEvidence: z.boolean().nullish(),
  isActive: z.boolean().optional(),
};

const createSchema = z.object({
  companyId: z.string().min(1),
  customRoleId: z.string().min(1),
  kpiId: z.string().min(1),
  ...roleKpiScoringSchema,
});

type CreateBody = z.infer<typeof createSchema>;

export async function GET(req: NextRequest) {
  const caller = await requirePermission(PERMISSIONS.KPI_VIEW_ALL);
  if (caller instanceof NextResponse) return caller;

  try {
    const requestedCompanyId = req.nextUrl.searchParams.get("companyId");
    const customRoleId = req.nextUrl.searchParams.get("customRoleId");
    // Company-scoped callers can't request another PT's KPI config, and
    // can't omit companyId to see every PT's config either.
    const companyId = requestedCompanyId ?? caller.companyId;

    if (companyId) assertCompanyAccess(caller, companyId);

    if (companyId && customRoleId) {
      return NextResponse.json(ok(await kpiService.getByCompanyRole(companyId, customRoleId)));
    }

    const all = await kpiService.getAllRoleKpis();
    const scoped = companyId ? all.filter((rk) => rk.companyId === companyId) : all;
    return NextResponse.json(ok(scoped));
  } catch (e) {
    return handleError(e);
  }
}

export const POST = withValidation(createSchema)(
  async (_req: NextRequest, ctx: { body: CreateBody }) => {
    const caller = await requirePermission(PERMISSIONS.KPI_MANAGE);
    if (caller instanceof NextResponse) return caller;

    try {
      assertCompanyAccess(caller, ctx.body.companyId);
      const roleKpi = await kpiService.createRoleKpi(ctx.body);
      return NextResponse.json(ok(roleKpi, "Konfigurasi KPI jabatan berhasil ditambahkan"), {
        status: 201,
      });
    } catch (e) {
      return handleError(e);
    }
  }
);
