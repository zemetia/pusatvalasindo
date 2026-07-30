import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { currencyPriceSyncService } from "@/backend/services/currency-price-sync.service";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { withValidation } from "@/backend/middleware/with-validation";
import { authorize } from "@/backend/helpers/authz";

const autoSyncSchema = z.object({ autoSync: z.boolean() });

type AutoSyncBody = z.infer<typeof autoSyncSchema>;

/** GET /api/harga-valas/auto-sync — status saklar + jejak sync terakhir. */
export async function GET() {
  try {
    const authz = await authorize("currency.price", "view");
    if (authz instanceof NextResponse) return authz;

    return NextResponse.json(ok(await currencyPriceSyncService.getSetting()));
  } catch (e) {
    return handleError(e);
  }
}

export const PUT = withValidation(autoSyncSchema)(
  async (_req: NextRequest, ctx: { body: AutoSyncBody }) => {
    try {
      const authz = await authorize("currency.price", "write");
      if (authz instanceof NextResponse) return authz;

      const setting = await currencyPriceSyncService.setAutoSync(
        ctx.body.autoSync,
        authz.userId
      );
      return NextResponse.json(
        ok(setting, ctx.body.autoSync ? "Auto-sync dinyalakan" : "Auto-sync dimatikan")
      );
    } catch (e) {
      return handleError(e);
    }
  }
);
