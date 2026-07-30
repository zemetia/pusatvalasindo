import { NextResponse } from "next/server";
import { getWatcherValasData } from "@/backend/services/watcher-valas.service";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { authorize } from "@/backend/helpers/authz";

// GET /api/watcher-valas
// Live cross-reference of SmartDeal counter rates vs Yahoo Finance mid-rate.
//
// Digerbangi resource `watcher.valas` (global), bukan sekadar `requireAuth`:
// halamannya sudah disembunyikan dari sidebar untuk yang tak berhak, jadi
// endpoint-nya harus menegakkan batas yang sama — bukan cuma "sudah login".
export async function GET() {
  try {
    const caller = await authorize("watcher.valas", "view");
    if (caller instanceof NextResponse) return caller;

    const data = await getWatcherValasData();
    return NextResponse.json(ok(data));
  } catch (e) {
    return handleError(e);
  }
}
