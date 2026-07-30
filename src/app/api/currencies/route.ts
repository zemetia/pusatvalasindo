import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { currencyService } from "@/backend/services/currency.service";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { withValidation } from "@/backend/middleware/with-validation";
import { authorize } from "@/backend/helpers/authz";

const createCurrencySchema = z.object({
  code: z.string().min(2).max(10),
  name: z.string().min(1).max(100),
  symbol: z.string().max(10).optional(),
});

type CreateBody = z.infer<typeof createCurrencySchema>;

export async function GET(req: NextRequest) {
  try {
    // Master mata uang tidak dimiliki PT mana pun, jadi yang berlaku hanya
    // punya-akses atau tidak — scope PT-nya dipakai di /api/currency-stock,
    // tempat angkanya benar-benar melekat pada cabang.
    const authz = await authorize("currency", "view");
    if (authz instanceof NextResponse) return authz;

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
      const authz = await authorize("currency", "write");
      if (authz instanceof NextResponse) return authz;

      const currency = await currencyService.create(ctx.body);
      return NextResponse.json(ok(currency, "Currency created"), { status: 201 });
    } catch (e) {
      return handleError(e);
    }
  }
);
