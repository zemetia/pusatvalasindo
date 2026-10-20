import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { authorize } from "@/backend/helpers/authz";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { withValidation } from "@/backend/middleware/with-validation";
import { blogService } from "@/backend/services/blog.service";
import { updateBlogCategorySchema, type UpdateBlogCategoryInput } from "@/lib/validations/blog";

type Params = { params: Promise<{ id: string }> };

export const PATCH = withValidation(updateBlogCategorySchema)(
  async (_req: NextRequest, ctx: { body: UpdateBlogCategoryInput } & Params) => {
    const authz = await authorize("blog", "write");
    if (authz instanceof NextResponse) return authz;

    try {
      const { id } = await ctx.params;
      return NextResponse.json(ok(await blogService.updateCategory(id, ctx.body), "Kategori disimpan"));
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
    await blogService.deleteCategory(id);
    return NextResponse.json(ok(null, "Kategori dihapus"));
  } catch (e) {
    return handleError(e);
  }
}
