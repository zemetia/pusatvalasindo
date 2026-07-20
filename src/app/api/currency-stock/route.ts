import { NextRequest, NextResponse } from "next/server";
import { currencyStockService, assertBranchAccess } from "@/backend/services/currency-stock.service";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { requirePermission } from "@/backend/helpers/get-admin-caller";
import { PERMISSIONS } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const caller = await requirePermission(PERMISSIONS.STOCK_VIEW);
  if (caller instanceof NextResponse) return caller;

  try {
    // Branch-scoped callers can't widen this via the query string; global/
    // company-scoped callers may still filter by an explicit branchId.
    const requestedBranchId = req.nextUrl.searchParams.get("branchId") ?? undefined;
    const branchId = caller.branchId ?? requestedBranchId;
    if (branchId) await assertBranchAccess(caller, branchId);

    const currencyId = req.nextUrl.searchParams.get("currencyId") ?? undefined;
    const stocks = await currencyStockService.getAll(branchId, currencyId);
    return NextResponse.json(ok(stocks));
  } catch (e) {
    return handleError(e);
  }
}
