import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
import type { NextRequest } from "next/server";

const handler = toNextJsHandler(auth.handler);

export const { GET } = handler;

export async function POST(req: NextRequest, ctx: unknown) {
  const url = new URL(req.url);
  if (url.pathname.endsWith("/sign-up/email")) {
    return new Response(
      JSON.stringify({ error: "Pendaftaran publik tidak tersedia" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }
  return handler.POST(req);
}
