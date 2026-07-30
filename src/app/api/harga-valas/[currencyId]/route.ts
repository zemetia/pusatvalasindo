import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { currencyPriceService } from "@/backend/services/currency-price.service";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { authorize } from "@/backend/helpers/authz";

type Params = { params: Promise<{ currencyId: string }> };

/** Mengosongkan harga sebuah mata uang — barisnya kembali ke "belum diisi". */
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const authz = await authorize("currency.price", "write");
    if (authz instanceof NextResponse) return authz;

    const { currencyId } = await params;
    await currencyPriceService.clear(currencyId);
    return NextResponse.json(ok(null, "Harga valas dikosongkan"));
  } catch (e) {
    return handleError(e);
  }
}
