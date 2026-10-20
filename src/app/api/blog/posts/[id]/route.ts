import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { authorize } from "@/backend/helpers/authz";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { withValidation } from "@/backend/middleware/with-validation";
import { blogService } from "@/backend/services/blog.service";
import { updateBlogPostSchema, type UpdateBlogPostInput } from "@/lib/validations/blog";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const authz = await authorize("blog", "view");
  if (authz instanceof NextResponse) return authz;

  try {
    const { id } = await params;
    return NextResponse.json(ok(await blogService.getPost(id)));
  } catch (e) {
    return handleError(e);
  }
}

export const PATCH = withValidation(updateBlogPostSchema)(
  async (_req: NextRequest, ctx: { body: UpdateBlogPostInput } & Params) => {
    const authz = await authorize("blog", "write");
    if (authz instanceof NextResponse) return authz;

    try {
      const { id } = await ctx.params;
      const post = await blogService.updatePost(id, ctx.body);
      return NextResponse.json(ok(post, "Artikel disimpan"));
    } catch (e) {
      return handleError(e);
    }
  }
);

export async function DELETE(_req: NextRequest, { params }: Params) {
  const authz = await authorize("blog", "write");
  if (authz instanceof NextResponse) return authz;

  try {
    const { id } = await params;
    await blogService.deletePost(id);
    return NextResponse.json(ok(null, "Artikel dihapus"));
  } catch (e) {
    return handleError(e);
  }
}
