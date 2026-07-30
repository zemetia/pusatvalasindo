import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { priceBenchmarkService } from "@/backend/services/price-benchmark.service";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { authorize } from "@/backend/helpers/authz";

/**
 * Final patokan harga (SmartDeal base + adjustment rule applied), as opposed to
 * the parent route which returns the adjustment rules themselves.
 *
 * GET /api/patokan-harga/harga        — all quoted currencies
 * GET /api/patokan-harga/harga?code=USD — one currency
 */
export async function GET(req: NextRequest) {
  const caller = await authorize("price.benchmark", "view");
  if (caller instanceof NextResponse) return caller;

  try {
    const code = req.nextUrl.searchParams.get("code") ?? undefined;
    const rows = await priceBenchmarkService.getQuotes(code);
    return NextResponse.json(ok(rows));
  } catch (e) {
    return handleError(e);
  }
}
