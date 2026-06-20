import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { kpiService } from "@/backend/services/kpi.service";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { withValidation } from "@/backend/middleware/with-validation";

const createSchema = z.object({
  companyId: z.string().min(1),
  customRoleId: z.string().min(1),
  kpiId: z.string().min(1),
  maxScore: z.number().positive().max(1),
  targetValue: z.number().positive().optional(),
  threshold: z.number().positive().optional(),
  weight: z.number().min(0).max(1),
});

type CreateBody = z.infer<typeof createSchema>;

export async function GET(req: NextRequest) {
  try {
    const companyId = req.nextUrl.searchParams.get("companyId");
    const customRoleId = req.nextUrl.searchParams.get("customRoleId");

    if (companyId && customRoleId) {
      return NextResponse.json(
        ok(await kpiService.getByCompanyRole(companyId, customRoleId))
      );
    }

    return NextResponse.json(ok(await kpiService.getAllRoleKpis()));
  } catch (e) {
    return handleError(e);
  }
}

export const POST = withValidation(createSchema)(
  async (_req: NextRequest, ctx: { body: CreateBody }) => {
    try {
      const roleKpi = await kpiService.createRoleKpi(ctx.body);
      return NextResponse.json(
        ok(roleKpi, "Konfigurasi KPI jabatan berhasil ditambahkan"),
        { status: 201 }
      );
    } catch (e) {
      return handleError(e);
    }
  }
);
