import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { currencyPriceService } from "@/backend/services/currency-price.service";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { withValidation } from "@/backend/middleware/with-validation";
import { authorize } from "@/backend/helpers/authz";

const savePriceSchema = z.object({
  currencyId: z.string().min(1),
  buyPrice: z.number().nonnegative(),
  sellPrice: z.number().nonnegative(),
  note: z.string().max(200).nullish(),
});

type SaveBody = z.infer<typeof savePriceSchema>;

/**
 * GET /api/harga-valas             — semua mata uang beserta harga kita
 * GET /api/harga-valas?active=true — hanya mata uang yang aktif
 */
export async function GET(req: NextRequest) {
  try {
    const authz = await authorize("currency.price", "view");
    if (authz instanceof NextResponse) return authz;

    const onlyActive = req.nextUrl.searchParams.get("active") === "true";
    const rows = await currencyPriceService.getAll(onlyActive);
    return NextResponse.json(ok(rows));
  } catch (e) {
    return handleError(e);
  }
}

export const PUT = withValidation(savePriceSchema)(
  async (_req: NextRequest, ctx: { body: SaveBody }) => {
    try {
      const authz = await authorize("currency.price", "write");
      if (authz instanceof NextResponse) return authz;

      const row = await currencyPriceService.save({
        ...ctx.body,
        updatedBy: authz.userId,
      });
      return NextResponse.json(ok(row, "Harga valas disimpan"));
    } catch (e) {
      return handleError(e);
    }
  }
);
