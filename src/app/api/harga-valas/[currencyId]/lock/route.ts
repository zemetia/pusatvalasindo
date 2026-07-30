import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { currencyPriceService } from "@/backend/services/currency-price.service";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { withValidation } from "@/backend/middleware/with-validation";
import { authorize } from "@/backend/helpers/authz";

const lockSchema = z.object({ isLocked: z.boolean() });

type Params = { params: Promise<{ currencyId: string }> };
type LockBody = z.infer<typeof lockSchema>;

/**
 * PUT /api/harga-valas/[currencyId]/lock — mengunci/membuka satu baris harga.
 *
 * Baris terkunci dilewati oleh setiap jalur sync. Ini satu-satunya cara
 * melindungi harga yang disetel manual.
 */
export const PUT = withValidation(lockSchema)(
  async (_req: NextRequest, ctx: Params & { body: LockBody }) => {
    try {
      const authz = await authorize("currency.price", "write");
      if (authz instanceof NextResponse) return authz;

      const { currencyId } = await ctx.params;
      const row = await currencyPriceService.setLock(
        currencyId,
        ctx.body.isLocked,
        authz.userId
      );
      return NextResponse.json(
        ok(row, ctx.body.isLocked ? "Harga dikunci" : "Kunci dilepas")
      );
    } catch (e) {
      return handleError(e);
    }
  }
);
