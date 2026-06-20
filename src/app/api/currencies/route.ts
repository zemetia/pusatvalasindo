import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currencyService } from "@/backend/services/currency.service";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { withValidation } from "@/backend/middleware/with-validation";

const createCurrencySchema = z.object({
  code: z.string().min(2).max(10),
  name: z.string().min(1).max(100),
  symbol: z.string().max(10).optional(),
});

type CreateBody = z.infer<typeof createCurrencySchema>;

export async function GET(req: NextRequest) {
  try {
    const onlyActive = req.nextUrl.searchParams.get("active") === "true";
    const currencies = await currencyService.getAll(onlyActive);
    return NextResponse.json(ok(currencies));
  } catch (e) {
    return handleError(e);
  }
}

export const POST = withValidation(createCurrencySchema)(
  async (_req: NextRequest, ctx: { body: CreateBody }) => {
    try {
      const currency = await currencyService.create(ctx.body);
      return NextResponse.json(ok(currency, "Currency created"), { status: 201 });
    } catch (e) {
      return handleError(e);
    }
  }
);
