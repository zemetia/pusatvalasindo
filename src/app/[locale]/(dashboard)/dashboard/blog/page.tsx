import { IconCategory, IconExternalLink, IconPlus } from "@tabler/icons-react";

import { requireResource } from "@/backend/helpers/authz";
import { blogService } from "@/backend/services/blog.service";
import {
  EmptyState,
  ErrorPanel,
  MetricBlock,
  MetricRow,
  PageHeader,
  PageShell,
  SectionCard,
} from "@/components/admin/page-shell";
import { BlogPostsTable } from "@/components/admin/blog/blog-posts-table";
import { BlogViewsChartLazy } from "@/components/admin/blog/blog-views-chart-lazy";
import { describeBlogError, toCategoryDTO, toRowDTO } from "@/components/admin/blog/mappers";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/routing";
import { RANGE_OPTIONS, parseRangeDays } from "@/lib/blog/analytics-range";
import { formatInt } from "@/lib/blog/format";
import { cn } from "@/lib/utils";

// Angka tampilan harus selalu terbaru — jangan di-cache.
export const dynamic = "force-dynamic";

export default async function BlogDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ range?: string | string[] }>;
}) {
  const { locale } = await params;
  const authz = await requireResource("blog", "view", locale);
  const canWrite = authz.can("blog", "write");
  const days = parseRangeDays((await searchParams).range);

  let data;
  try {
    const [overview, list, categories] = await Promise.all([
      blogService.getOverview(days),
      blogService.listPosts({ days, limit: 200 }),
      blogService.listCategories(),
    ]);
    data = { overview, list, categories };
  } catch (err) {
    return <ErrorPanel source="blog/page" message={describeBlogError(err)} />;
  }

  const { overview: o, list, categories } = data;
  const period = `vs ${days} hari sebelumnya`;
  const maxReferrer = Math.max(1, ...o.referrers.map((r) => r.views));

  return (
    <PageShell>
      <PageHeader
        eyebrow="Blog Studio"
        title="Dashboard Blog"
        description="Tulis dan kelola artikel di situs publik, lalu pantau berapa banyak yang membacanya. Bot dan kunjungan ulang dalam 30 menit tidak dihitung. Urutkan tabel menurut tampilan untuk melihat artikel terpopuler."
        action={
          <>
            <Link
              href="/blog"
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              <IconExternalLink className="size-4" /> Lihat Situs Publik
            </Link>
            <Link href="/dashboard/blog/kategori" className={buttonVariants({ variant: "outline", size: "sm" })}>
              <IconCategory className="size-4" /> Kategori
            </Link>
            {canWrite && (
              <Link href="/dashboard/blog/baru" className={buttonVariants({ size: "sm" })}>
                <IconPlus className="size-4" /> Artikel baru
              </Link>
            )}
          </>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">Ringkasan performa</p>
        <nav aria-label="Rentang waktu" className="bg-muted/60 inline-flex items-center gap-1 rounded-lg p-1">
          {RANGE_OPTIONS.map((r) => (
            <Link
              key={r}
              href={`/dashboard/blog?range=${r}`}
              aria-current={r === days ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
                r === days ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {r} hari
            </Link>
          ))}
        </nav>
      </div>

      <MetricRow columns={4}>
        <MetricBlock label="Tampilan" value={formatInt(o.views)} delta={o.viewsDelta} period={period} />
        <MetricBlock label="Pengunjung" value={formatInt(o.visitors)} delta={o.visitorsDelta} period={period} />
        <MetricBlock
          label="Artikel terbit"
          value={formatInt(o.counts.PUBLISHED)}
          meta={`${formatInt(o.counts.DRAFT)} draft · ${formatInt(o.counts.SCHEDULED)} terjadwal · ${formatInt(o.counts.ARCHIVED)} diarsipkan`}
        />
        <MetricBlock label="Total tampilan" value={formatInt(o.allTimeViews)} meta="sepanjang masa, semua artikel" />
      </MetricRow>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <SectionCard
          title="Tampilan per hari"
          description="Garis tegas = tampilan, putus-putus = pengunjung unik (WIB)."
          action={<span className="tabular text-sm font-semibold">{formatInt(o.views)} tampilan</span>}
        >
          <BlogViewsChartLazy data={o.daily} />
        </SectionCard>

        <SectionCard title="Sumber trafik" description="Dari mana pembaca datang">
          {o.referrers.length === 0 ? (
            <EmptyState title="Belum ada data" description="Sumber kunjungan tercatat setelah ada pembaca." className="py-8" />
          ) : (
            <ul className="space-y-3">
              {o.referrers.map((r) => (
                <li key={r.source ?? "direct"}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate">{r.source ?? "Langsung / tidak diketahui"}</span>
                    <span className="tabular text-muted-foreground shrink-0">{formatInt(r.views)}</span>
                  </div>
                  <div className="bg-muted mt-1.5 h-1 overflow-hidden rounded-full">
                    <div className="bg-primary h-full rounded-full" style={{ width: `${(r.views / maxReferrer) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <BlogPostsTable
        posts={list.items.map(toRowDTO)}
        categories={categories.map(toCategoryDTO)}
        counts={o.counts}
        total={list.total}
        days={days}
        canWrite={canWrite}
      />
    </PageShell>
  );
}
