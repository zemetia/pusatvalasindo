import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';

import { blogService } from '@/backend/services/blog.service';
import { siteConfig } from '@/config/site';
import { FinalCta } from '@/components/landing/sections';
import { PageIntro } from '@/components/landing/page-intro';
import { InnerPage, RelatedLinks } from '@/components/landing/page-sections';
import { Section } from '@/components/landing/ui';
import { CategoryNav } from '@/components/blog/category-nav';
import { PostCard } from '@/components/blog/post-card';
import { Link } from '@/i18n/routing';
import { buildMetadata } from '@/lib/seo';
import {
  blogSchema,
  breadcrumbSchema,
  organizationSchema,
  webPageSchema,
  websiteSchema,
} from '@/lib/structured-data';

interface Props {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ halaman?: string | string[] }>;
}

/** Nomor halaman dari query. Nilai aneh (negatif, huruf, array) jatuh ke halaman 1. */
function pageNumber(raw: string | string[] | undefined): number {
  const n = parseInt(Array.isArray(raw) ? raw[0] : (raw ?? '1'), 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

// Dipakai bersama generateMetadata & halaman dalam satu request.
const getCategoryPage = cache((slug: string, p: number) => blogService.listLivePostsByCategory(slug, p));

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const data = await getCategoryPage(slug, pageNumber((await searchParams).halaman));
  // Kategori tidak ada / kosong: halamannya 404, tidak perlu metadata.
  if (!data) return {};

  const { category } = data;
  const base = `Blog ${category.name}`;
  const path = `/blog/kategori/${category.slug}`;
  return buildMetadata({
    title: data.page > 1 ? `Halaman ${data.page} — ${base} | ${siteConfig.name}` : `${base} | ${siteConfig.name}`,
    description:
      category.description ??
      `Kumpulan artikel dan panduan ${category.name.toLowerCase()} dari ${siteConfig.name}, money changer berizin Bank Indonesia di Jakarta & Tangerang.`,
    path: data.page > 1 ? `${path}?halaman=${data.page}` : path,
    locale,
    keywords: [category.name, 'blog valas', 'tips tukar valas', 'money changer jakarta'],
    noIndex: !siteConfig.contentLocales.includes(locale),
  });
}

export default async function BlogCategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const [data, categories] = await Promise.all([
    getCategoryPage(slug, pageNumber((await searchParams).halaman)),
    blogService.listLiveCategories(),
  ]);
  if (!data) notFound();

  const { category, items, total, page: current, totalPages } = data;
  const path = `/blog/kategori/${category.slug}`;
  const url = `${siteConfig.url}${path}`;
  const description =
    category.description ?? `Kumpulan artikel dan panduan ${category.name.toLowerCase()} dari ${siteConfig.name}.`;

  const schemas = [
    organizationSchema(),
    websiteSchema(),
    webPageSchema({
      name: `Blog ${category.name}`,
      description,
      url,
      dateModified: items.reduce((latest, p) => (p.updatedAt > latest ? p.updatedAt : latest), category.updatedAt).toISOString(),
    }),
    breadcrumbSchema([
      { name: 'Beranda', url: siteConfig.url },
      { name: 'Blog', url: `${siteConfig.url}/blog` },
      { name: category.name, url },
    ]),
    blogSchema({
      name: `Blog ${category.name} — ${siteConfig.name}`,
      description,
      url,
      posts: items.flatMap((p) =>
        p.publishedAt
          ? [{ headline: p.title, url: `${siteConfig.url}/blog/${p.slug}`, datePublished: p.publishedAt.toISOString() }]
          : []
      ),
    }),
  ];

  return (
    <InnerPage id={`blog-kategori-${category.slug}`} schemas={schemas}>
      <PageIntro
        crumbs={[{ name: 'Beranda', href: '/' }, { name: 'Blog', href: '/blog' }, { name: category.name }]}
        eyebrow="Kategori"
        title={category.name}
        lead={description}
      />

      <Section tone="paper">
        <CategoryNav
          className="mb-10"
          active={category.slug}
          categories={categories.map((c) => ({ slug: c.slug, name: c.name, count: c._count.posts }))}
        />
        <p className="mb-8 text-sm text-lp-ink-mute">
          {total} artikel{totalPages > 1 ? ` · halaman ${current} dari ${totalPages}` : ''}
        </p>
        <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </div>
        {totalPages > 1 && (
          <nav aria-label="Halaman artikel" className="mt-12 flex items-center justify-between gap-4 text-sm font-semibold">
            {current > 1 ? (
              <Link
                href={current === 2 ? path : `${path}?halaman=${current - 1}`}
                rel="prev"
                className="text-lp-red-700 underline-offset-4 hover:underline"
              >
                ← Artikel lebih baru
              </Link>
            ) : (
              <span />
            )}
            {current < totalPages ? (
              <Link
                href={`${path}?halaman=${current + 1}`}
                rel="next"
                className="text-lp-red-700 underline-offset-4 hover:underline"
              >
                Artikel lebih lama →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </Section>
      <RelatedLinks currentPath="/blog" tone="paper2" />
      <FinalCta />
    </InnerPage>
  );
}
