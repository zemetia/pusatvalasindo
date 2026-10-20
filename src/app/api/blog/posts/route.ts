import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { authorize } from "@/backend/helpers/authz";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { withValidation } from "@/backend/middleware/with-validation";
import { blogService } from "@/backend/services/blog.service";
import { parseRangeDays } from "@/lib/blog/analytics-range";
import { DISPLAY_STATUSES, type BlogDisplayStatus } from "@/lib/blog/status";
import { createBlogPostSchema, type CreateBlogPostInput } from "@/lib/validations/blog";

export async function GET(req: NextRequest) {
  const authz = await authorize("blog", "view");
  if (authz instanceof NextResponse) return authz;

  try {
    const sp = req.nextUrl.searchParams;
    const status = sp.get("status");
    const limit = Math.min(Math.max(parseInt(sp.get("limit") ?? "50", 10) || 50, 1), 200);
    const offset = Math.max(parseInt(sp.get("offset") ?? "0", 10) || 0, 0);

    const result = await blogService.listPosts({
      status: DISPLAY_STATUSES.includes(status as BlogDisplayStatus) ? (status as BlogDisplayStatus) : undefined,
      search: sp.get("search") || undefined,
      categoryId: sp.get("categoryId") || undefined,
      days: parseRangeDays(sp.get("days")),
      limit,
      offset,
    });
    return NextResponse.json(ok(result));
  } catch (e) {
    return handleError(e);
  }
}

export const POST = withValidation(createBlogPostSchema)(
  async (_req: NextRequest, ctx: { body: CreateBlogPostInput }) => {
    const authz = await authorize("blog", "write");
    if (authz instanceof NextResponse) return authz;

    try {
      const post = await blogService.createPost(ctx.body, authz.userId);
      return NextResponse.json(ok(post, "Artikel dibuat"), { status: 201 });
    } catch (e) {
      return handleError(e);
    }
  }
);
