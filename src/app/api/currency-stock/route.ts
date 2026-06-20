import { NextRequest, NextResponse } from "next/server";
import { currencyStockService } from "@/backend/services/currency-stock.service";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";

export async function GET(req: NextRequest) {
  try {
    const branchId = req.nextUrl.searchParams.get("branchId") ?? undefined;
    const currencyId = req.nextUrl.searchParams.get("currencyId") ?? undefined;
    const stocks = await currencyStockService.getAll(branchId, currencyId);
    return NextResponse.json(ok(stocks));
  } catch (e) {
    return handleError(e);
  }
}
