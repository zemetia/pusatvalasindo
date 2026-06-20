import { NextResponse } from "next/server";
import { ok } from "@/backend/helpers/api-response";

export async function GET() {
  return NextResponse.json(ok({ status: "ok" }, "API is running"));
}
