import { requireResource } from "@/backend/helpers/authz";
import { blogService } from "@/backend/services/blog.service";
import { ErrorPanel } from "@/components/admin/page-shell";
import { BlogPostEditor } from "@/components/admin/blog/blog-post-editor";
import { describeBlogError, toCategoryDTO } from "@/components/admin/blog/mappers";

export const dynamic = "force-dynamic";

export default async function NewBlogPostPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  // Membuat artikel butuh izin TULIS; pemegang izin lihat saja dikembalikan ke dashboard.
  await requireResource("blog", "write", locale);

  let categories;
  try {
    categories = await blogService.listCategories();
  } catch (err) {
    return <ErrorPanel source="blog/baru/page" message={describeBlogError(err)} />;
  }

  return <BlogPostEditor post={null} categories={categories.map(toCategoryDTO)} stats={null} canWrite />;
}
