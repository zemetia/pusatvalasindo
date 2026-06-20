import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { kpiService } from "@/backend/services/kpi.service";
import { ok, fail } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { withValidation } from "@/backend/middleware/with-validation";

const createSchema = z.object({
  employeeId: z.string().min(1),
  kpiId: z.string().min(1),
  value: z.number().positive(),
  note: z.string().max(500).optional(),
});

type CreateBody = z.infer<typeof createSchema>;

export async function GET(req: NextRequest) {
  try {
    const employeeId = req.nextUrl.searchParams.get("employeeId");
    if (!employeeId) {
      return NextResponse.json(
        fail("VALIDATION", "employeeId diperlukan"),
        { status: 400 }
      );
    }

    const month = Number(req.nextUrl.searchParams.get("month"));
    const year = Number(req.nextUrl.searchParams.get("year"));

    const logs =
      month && year
        ? await kpiService.getLogsByEmployeePeriod(employeeId, month, year)
        : await kpiService.getLogsByEmployee(employeeId);

    return NextResponse.json(ok(logs));
  } catch (e) {
    return handleError(e);
  }
}

export const POST = withValidation(createSchema)(
  async (_req: NextRequest, ctx: { body: CreateBody }) => {
    try {
      const log = await kpiService.createLog(ctx.body);
      return NextResponse.json(ok(log, "Log KPI berhasil dicatat"), {
        status: 201,
      });
    } catch (e) {
      return handleError(e);
    }
  }
);
