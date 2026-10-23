import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { ValidationError } from "@/backend/errors/app-error";
import { blogService } from "@/backend/services/blog.service";
import { blogPostRepository } from "@/backend/repositories/blog-post.repository";
import { siteConfig } from "@/config/site";
import { blogViewSchema } from "@/lib/validations/blog";

/**
 * Pencatat tampilan artikel — SENGAJA publik (pengunjung tidak punya sesi).
 * Daftar putih di src/middleware.ts hanya membuka path ini. Penjaganya ada di
 * sini, bukan di middleware: body divalidasi, bot dibuang, id harus milik
 * artikel yang benar-benar tayang, dan tampilan berulang dalam 30 menit tidak
 * dihitung. Rate limit 60/menit/IP dari middleware tetap berlaku.
 *
 * Responsnya selalu `{ counted }` — pemanggil tidak perlu (dan tidak boleh)
 * tahu alasan sebuah kunjungan tidak dihitung.
 */
export async function POST(req: NextRequest) {
  try {
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      throw new ValidationError("Request body must be valid JSON");
    }
    const parsed = blogViewSchema.safeParse(raw);
    if (!parsed.success) throw new ValidationError("Invalid payload");

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";

    const result = await blogService.recordView({
      postId: parsed.data.postId,
      ip,
      userAgent: req.headers.get("user-agent") ?? "",
      referrer: parsed.data.referrer ?? null,
      ownHosts: [new URL(siteConfig.url).host, req.headers.get("host")],
    });
    let viewCount: number | undefined;
    if (result === "counted") {
      const live = await blogPostRepository.findLiveId(parsed.data.postId);
      if (live) viewCount = live.viewCount;
    }

    return NextResponse.json(ok({ counted: result === "counted", viewCount }));
  } catch (e) {
    return handleError(e);
  }
}
