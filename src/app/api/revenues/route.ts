import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { kpiService } from "@/backend/services/kpi.service";
import { ok, fail } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { withValidation } from "@/backend/middleware/with-validation";
import { requirePermission } from "@/backend/helpers/get-admin-caller";
import { PERMISSIONS } from "@/lib/permissions";

const createSchema = z.object({
  employeeId: z.string().min(1),
  amount: z.number().positive(),
  note: z.string().max(500).optional(),
});

type CreateBody = z.infer<typeof createSchema>;

export async function GET(req: NextRequest) {
  try {
    // Target/revenue per karyawan adalah bagian dari modul KPI dan bisa dibaca untuk
    // employeeId mana pun lewat query param, jadi ikut izin lihat-semua KPI.
    const caller = await requirePermission(PERMISSIONS.KPI_VIEW_ALL);
    if (caller instanceof NextResponse) return caller;

    const employeeId = req.nextUrl.searchParams.get("employeeId");
    if (!employeeId) {
      return NextResponse.json(
        fail("VALIDATION", "employeeId diperlukan"),
        { status: 400 }
      );
    }

    const month = Number(req.nextUrl.searchParams.get("month"));
    const year = Number(req.nextUrl.searchParams.get("year"));

    const revenues =
      month && year
        ? await kpiService.getRevenuesByEmployeePeriod(employeeId, month, year)
        : await kpiService.getRevenuesByEmployee(employeeId);

    return NextResponse.json(ok(revenues));
  } catch (e) {
    return handleError(e);
  }
}

export const POST = withValidation(createSchema)(
  async (_req: NextRequest, ctx: { body: CreateBody }) => {
    try {
      const caller = await requirePermission(PERMISSIONS.KPI_MANAGE);
      if (caller instanceof NextResponse) return caller;

      const revenue = await kpiService.createRevenue(ctx.body);
      return NextResponse.json(ok(revenue, "Target dicatat"), { status: 201 });
    } catch (e) {
      return handleError(e);
    }
  }
);
