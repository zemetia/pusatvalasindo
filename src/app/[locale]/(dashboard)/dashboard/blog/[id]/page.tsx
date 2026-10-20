import { notFound } from "next/navigation";

import { requireResource } from "@/backend/helpers/authz";
import { NotFoundError } from "@/backend/errors/app-error";
import { blogService } from "@/backend/services/blog.service";
import { ErrorPanel } from "@/components/admin/page-shell";
import { BlogPostEditor } from "@/components/admin/blog/blog-post-editor";
import { describeBlogError, toCategoryDTO, toEditorDTO } from "@/components/admin/blog/mappers";

export const dynamic = "force-dynamic";

const STATS_DAYS = 30;

export default async function EditBlogPostPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const authz = await requireResource("blog", "view", locale);

  let post, categories, analytics;
  try {
    [post, categories, analytics] = await Promise.all([
      blogService.getPost(id),
      blogService.listCategories(),
      blogService.getPostAnalytics(id, STATS_DAYS),
    ]);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    return <ErrorPanel source="blog/[id]/page" message={describeBlogError(err)} />;
  }

  return (
    <BlogPostEditor
      // Memaksa editor di-remount saat pindah antar artikel; state formnya diinisialisasi dari props sekali.
      key={post.id}
      post={toEditorDTO(post)}
      categories={categories.map(toCategoryDTO)}
      canWrite={authz.can("blog", "write")}
      stats={{
        days: analytics.days,
        views: analytics.views,
        visitors: analytics.visitors,
        viewsDelta: analytics.viewsDelta,
        allTimeViews: analytics.allTimeViews,
        referrers: analytics.referrers.map((r) => ({ source: r.source, views: r.views })),
      }}
    />
  );
}
