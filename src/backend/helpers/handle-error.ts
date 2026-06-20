import { NextResponse } from "next/server";
import { AppError } from "@/backend/errors/app-error";
import { fail } from "./api-response";

export function handleError(e: unknown): NextResponse {
  if (e instanceof AppError) {
    return NextResponse.json(fail(e.code, e.message), { status: e.statusCode });
  }
  console.error("[Unhandled error]", e);
  return NextResponse.json(fail("Server error", "An unexpected error occurred"), { status: 500 });
}
