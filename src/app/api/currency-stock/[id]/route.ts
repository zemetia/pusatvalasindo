import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currencyStockService } from "@/backend/services/currency-stock.service";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { withValidation } from "@/backend/middleware/with-validation";
import { requirePermission } from "@/backend/helpers/get-admin-caller";
import { PERMISSIONS } from "@/lib/permissions";

const updateRatesSchema = z.object({
  buyRate: z.number().positive().optional(),
  sellRate: z.number().positive().optional(),
});

type Params = { params: Promise<{ id: string }> };
type UpdateBody = z.infer<typeof updateRatesSchema>;

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const caller = await requirePermission(PERMISSIONS.STOCK_VIEW);
    if (caller instanceof NextResponse) return caller;

    const { id } = await params;
    const stock = await currencyStockService.getById(id);
    return NextResponse.json(ok(stock));
  } catch (e) {
    return handleError(e);
  }
}

export const PUT = withValidation(updateRatesSchema)(
  async (_req: NextRequest, ctx: Params & { body: UpdateBody }) => {
    try {
      const caller = await requirePermission(PERMISSIONS.STOCK_MANAGE);
      if (caller instanceof NextResponse) return caller;

      const { id } = await ctx.params;
      const stock = await currencyStockService.updateRates(id, ctx.body.buyRate, ctx.body.sellRate);
      return NextResponse.json(ok(stock, "Rates updated"));
    } catch (e) {
      return handleError(e);
    }
  }
);
