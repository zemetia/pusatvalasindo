import { NextResponse } from "next/server";
import { getWatcherValasData } from "@/backend/services/watcher-valas.service";
import { smartdealRateService } from "@/backend/services/smartdeal-rate.service";
import { currencyPriceSyncService } from "@/backend/services/currency-price-sync.service";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { authorize } from "@/backend/helpers/authz";

// POST /api/watcher-valas/scrape
// Manual counterpart to the cron-only /api/scrape/smartdeal: lets an admin
// trigger a live SmartDeal scrape from the Watcher Valas page itself instead
// of waiting for the external scheduler. Session-gated (action "write", which
// `watcher.valas` being `readOnly` restricts to global roles) rather than the
// cron's bearer secret — the browser has a session, not CRON_SECRET.
//
// A failed scrape is not fatal here: `refreshFromSource` already records it
// into SmartdealScrapeStatus, and the response below still returns fresh
// data so the page can show the "Down" badge instead of a dead Refresh button.
export async function POST() {
  try {
    const caller = await authorize("watcher.valas", "write");
    if (caller instanceof NextResponse) return caller;

    try {
      await smartdealRateService.refreshFromSource();
      await currencyPriceSyncService.runIfAutoEnabled();
    } catch {
      // Swallowed — status already recorded, surfaced via smartdealStatus below.
    }

    const data = await getWatcherValasData();
    return NextResponse.json(ok(data));
  } catch (e) {
    return handleError(e);
  }
}
