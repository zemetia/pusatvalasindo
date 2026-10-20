import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { authorize } from "@/backend/helpers/authz";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { withValidation } from "@/backend/middleware/with-validation";
import { blogService } from "@/backend/services/blog.service";
import { createBlogCategorySchema, type CreateBlogCategoryInput } from "@/lib/validations/blog";

export async function GET() {
  const authz = await authorize("blog", "view");
  if (authz instanceof NextResponse) return authz;

  try {
    return NextResponse.json(ok(await blogService.listCategories()));
  } catch (e) {
    return handleError(e);
  }
}

export const POST = withValidation(createBlogCategorySchema)(
  async (_req: NextRequest, ctx: { body: CreateBlogCategoryInput }) => {
    const authz = await authorize("blog", "write");
    if (authz instanceof NextResponse) return authz;

    try {
      const category = await blogService.createCategory(ctx.body);
      return NextResponse.json(ok(category, "Kategori dibuat"), { status: 201 });
    } catch (e) {
      return handleError(e);
    }
  }
);
