import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { NotFoundError, ValidationError } from "@/backend/errors/app-error";
import { blogService } from "@/backend/services/blog.service";
import { blogVoteSchema } from "@/lib/validations/blog";

/**
 * Endpoint publik untuk tanggapan artikel:
 * "Apakah artikel ini membantu?" (upvote / downvote).
 *
 * Publik (pembaca umum tidak perlu sesi).
 * Dilindungi rate limiting di middleware (60 req/menit/IP), bot filtering,
 * dan idempoten (toggle / switch).
 */
export async function POST(req: NextRequest) {
  try {
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      throw new ValidationError("Request body must be valid JSON");
    }

    const parsed = blogVoteSchema.safeParse(raw);
    if (!parsed.success) throw new ValidationError("Invalid payload");

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";
    const userAgent = req.headers.get("user-agent") ?? "";

    const result = await blogService.recordVote({
      postId: parsed.data.postId,
      vote: parsed.data.vote,
      ip,
      userAgent,
    });

    if (result.status === "not_found") {
      throw new NotFoundError("Artikel tidak ditemukan");
    }

    return NextResponse.json(
      ok(
        result.data ?? {
          upvoteCount: 0,
          downvoteCount: 0,
          userVote: null,
        }
      )
    );
  } catch (e) {
    return handleError(e);
  }
}

export async function GET(req: NextRequest) {
  try {
    const postId = req.nextUrl.searchParams.get("postId")?.trim();
    if (!postId) throw new ValidationError("Parameter postId wajib diisi");

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";
    const userAgent = req.headers.get("user-agent") ?? "";

    const result = await blogService.getVoteStatus(postId, ip, userAgent);
    if (result.status === "not_found") {
      throw new NotFoundError("Artikel tidak ditemukan");
    }

    return NextResponse.json(ok(result.data));
  } catch (e) {
    return handleError(e);
  }
}
