import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";
import { currencyStockService, assertBranchAccess } from "@/backend/services/currency-stock.service";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { authorize } from "@/backend/helpers/authz";

export async function GET(req: NextRequest) {
  const authz = await authorize("currency.stock", "view");
  if (authz instanceof NextResponse) return authz;

  try {
    // Branch-scoped callers can't widen this via the query string; global/
    // company-scoped callers may still filter by an explicit branchId.
    const requestedBranchId = req.nextUrl.searchParams.get("branchId") ?? undefined;
    const branchId = authz.branchId ?? requestedBranchId;
    if (branchId) await assertBranchAccess(authz, branchId);

    const currencyId = req.nextUrl.searchParams.get("currencyId") ?? undefined;
    // Tanpa branchId, daftarnya tetap dipersempit ke PT dalam scope baca —
    // sebelumnya request tanpa filter mengembalikan stok SELURUH PT.
    const stocks = await currencyStockService.getAll(branchId, currencyId, authz.companyIds);
    return NextResponse.json(ok(stocks));
  } catch (e) {
    return handleError(e);
  }
}
