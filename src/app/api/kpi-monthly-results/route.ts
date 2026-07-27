import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { kpiService } from "@/backend/services/kpi.service";
import { ok, fail } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { withValidation } from "@/backend/middleware/with-validation";
import { requirePermission } from "@/backend/helpers/get-admin-caller";
import { PERMISSIONS } from "@/lib/permissions";

const calculateSchema = z.object({
  employeeId: z.string().min(1),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
});

type CalculateBody = z.infer<typeof calculateSchema>;

export async function GET(req: NextRequest) {
  try {
    const caller = await requirePermission(PERMISSIONS.KPI_VIEW_ALL);
    if (caller instanceof NextResponse) return caller;

    const employeeId = req.nextUrl.searchParams.get("employeeId");
    const month = Number(req.nextUrl.searchParams.get("month"));
    const year = Number(req.nextUrl.searchParams.get("year"));

    if (!employeeId || !month || !year) {
      return NextResponse.json(
        fail("VALIDATION", "employeeId, month, dan year diperlukan"),
        { status: 400 }
      );
    }

    const result = await kpiService.getMonthlyResult(employeeId, month, year);
    return NextResponse.json(ok(result));
  } catch (e) {
    return handleError(e);
  }
}

export const POST = withValidation(calculateSchema)(
  async (_req: NextRequest, ctx: { body: CalculateBody }) => {
    try {
      const caller = await requirePermission(PERMISSIONS.KPI_MANAGE);
      if (caller instanceof NextResponse) return caller;

      const { employeeId, month, year } = ctx.body;
      const result = await kpiService.calculateMonthlyResult(
        employeeId,
        month,
        year
      );
      return NextResponse.json(ok(result, "KPI bulan ini berhasil dihitung"), {
        status: 201,
      });
    } catch (e) {
      return handleError(e);
    }
  }
);
