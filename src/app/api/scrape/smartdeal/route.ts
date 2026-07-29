import { NextRequest, NextResponse } from "next/server";
import { ok, fail } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { smartdealRateService } from "@/backend/services/smartdeal-rate.service";

// GET /api/scrape/smartdeal
// Runs the SmartDeal scrape and upserts the results into SmartdealRate — not
// tied to any particular scheduler. Point any external cron (Vercel Cron,
// GitHub Actions, cron-job.org, etc.) at this URL with
// `Authorization: Bearer <CRON_SECRET>`. No session cookie is available to
// external callers, so this route is exempted from the session-cookie gate
// in middleware.ts (alongside /api/mcp) and checks the bearer secret itself.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(fail("NOT_CONFIGURED", "CRON_SECRET is not set"), { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json(fail("UNAUTHORIZED", "Invalid or missing cron secret"), { status: 401 });
  }

  try {
    const result = await smartdealRateService.refreshFromSource();
    return NextResponse.json(ok(result));
  } catch (e) {
    return handleError(e);
  }
}
