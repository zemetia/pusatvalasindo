import { NextResponse } from "next/server";
import { getWatcherValasData } from "@/backend/services/watcher-valas.service";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";

// GET /api/watcher-valas
// Live cross-reference of SmartDeal counter rates vs Yahoo Finance mid-rate.
export async function GET() {
  try {
    const data = await getWatcherValasData();
    return NextResponse.json(ok(data));
  } catch (e) {
    return handleError(e);
  }
}
