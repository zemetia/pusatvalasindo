import { IconArrowLeft } from "@tabler/icons-react";

import { requireResource } from "@/backend/helpers/authz";
import { blogService } from "@/backend/services/blog.service";
import { ErrorPanel, PageHeader, PageShell } from "@/components/admin/page-shell";
import { BlogCategoriesClient } from "@/components/admin/blog/blog-categories-client";
import { describeBlogError, toCategoryDTO } from "@/components/admin/blog/mappers";
import { Link } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export default async function BlogCategoriesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const authz = await requireResource("blog", "view", locale);

  let categories;
  try {
    categories = await blogService.listCategories();
  } catch (err) {
    return <ErrorPanel source="blog/kategori/page" message={describeBlogError(err)} />;
  }

  return (
    <PageShell width="narrow">
      <PageHeader
        eyebrow="Blog"
        title="Kategori"
        description="Kelompok artikel. Menghapus kategori tidak menghapus artikelnya."
        action={
          <Link href="/dashboard/blog" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm">
            <IconArrowLeft className="size-4" /> Semua artikel
          </Link>
        }
      />
      <BlogCategoriesClient categories={categories.map(toCategoryDTO)} canWrite={authz.can("blog", "write")} />
    </PageShell>
  );
}
