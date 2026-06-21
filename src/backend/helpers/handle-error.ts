import { NextResponse } from "next/server";
import { AppError } from "@/backend/errors/app-error";
import { fail } from "./api-response";

export function handleError(e: unknown): NextResponse {
  if (e instanceof AppError) {
    return NextResponse.json(fail(e.code, e.message), { status: e.statusCode });
  }
  const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  console.error("[Unhandled error]", e);
  return NextResponse.json(fail("Server error", msg), { status: 500 });
}
