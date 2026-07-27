import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currencyService } from "@/backend/services/currency.service";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { withValidation } from "@/backend/middleware/with-validation";
import { requirePermission } from "@/backend/helpers/get-admin-caller";
import { PERMISSIONS } from "@/lib/permissions";

const updateCurrencySchema = z.object({
  code: z.string().min(2).max(10).optional(),
  name: z.string().min(1).max(100).optional(),
  symbol: z.string().max(10).optional(),
  isActive: z.boolean().optional(),
});

type Params = { params: Promise<{ id: string }> };
type UpdateBody = z.infer<typeof updateCurrencySchema>;

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const caller = await requirePermission(PERMISSIONS.CURRENCY_VIEW);
    if (caller instanceof NextResponse) return caller;

    const { id } = await params;
    const currency = await currencyService.getById(id);
    return NextResponse.json(ok(currency));
  } catch (e) {
    return handleError(e);
  }
}

export const PUT = withValidation(updateCurrencySchema)(
  async (_req: NextRequest, ctx: Params & { body: UpdateBody }) => {
    try {
      const caller = await requirePermission(PERMISSIONS.CURRENCY_MANAGE);
      if (caller instanceof NextResponse) return caller;

      const { id } = await ctx.params;
      const currency = await currencyService.update(id, ctx.body);
      return NextResponse.json(ok(currency, "Currency updated"));
    } catch (e) {
      return handleError(e);
    }
  }
);

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const caller = await requirePermission(PERMISSIONS.CURRENCY_MANAGE);
    if (caller instanceof NextResponse) return caller;

    const { id } = await params;
    await currencyService.delete(id);
    return NextResponse.json(ok(null, "Currency deleted"));
  } catch (e) {
    return handleError(e);
  }
}
