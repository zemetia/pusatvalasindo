import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { currencyService } from "@/backend/services/currency.service";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { withValidation } from "@/backend/middleware/with-validation";
import { authorize } from "@/backend/helpers/authz";

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
    const authz = await authorize("currency", "view");
    if (authz instanceof NextResponse) return authz;

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
      const authz = await authorize("currency", "write");
      if (authz instanceof NextResponse) return authz;

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
    const authz = await authorize("currency", "write");
    if (authz instanceof NextResponse) return authz;

    const { id } = await params;
    await currencyService.delete(id);
    return NextResponse.json(ok(null, "Currency deleted"));
  } catch (e) {
    return handleError(e);
  }
}
