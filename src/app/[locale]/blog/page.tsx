import type { Metadata } from 'next';
import { cache } from 'react';

import { blogService } from '@/backend/services/blog.service';
import { siteConfig } from '@/config/site';
import { FinalCta } from '@/components/landing/sections';
import { PageIntro } from '@/components/landing/page-intro';
import { InnerPage, RelatedLinks } from '@/components/landing/page-sections';
import { Section } from '@/components/landing/ui';
import { CategoryNav } from '@/components/blog/category-nav';
import { FeaturedPostCard, PostCard } from '@/components/blog/post-card';
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
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ halaman?: string | string[] }>;
}

const page = siteConfig.pages.blog;

/** Nomor halaman dari query. Nilai aneh (negatif, huruf, array) jatuh ke halaman 1. */
function pageNumber(raw: string | string[] | undefined): number {
  const n = parseInt(Array.isArray(raw) ? raw[0] : (raw ?? '1'), 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

// Dipakai bersama generateMetadata & halaman dalam satu request.
const getPosts = cache((p: number) => blogService.listLivePosts(p));

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale } = await params;
  const data = await getPosts(pageNumber((await searchParams).halaman));
  return buildMetadata({
    title: data.page > 1 ? `Halaman ${data.page} — ${page.title}` : page.title,
    description: page.description,
    path: data.page > 1 ? `${page.path}?halaman=${data.page}` : page.path,
    locale,
    keywords: [
      'blog valas',
      'tips tukar valas',
      'kurs dollar hari ini',
      'money changer jakarta',
      'kirim uang ke luar negeri',
      'tukar uang tanpa antre',
    ],
    // Indeks kosong = thin content; jangan diindeks sebelum ada artikel.
    noIndex: !siteConfig.contentLocales.includes(locale) || data.total === 0,
  });
}

export default async function BlogIndexPage({ searchParams }: Props) {
  const [{ items, total, page: current, totalPages }, categories] = await Promise.all([
    getPosts(pageNumber((await searchParams).halaman)),
    blogService.listLiveCategories(),
  ]);

  const url = `${siteConfig.url}${page.path}`;
  const schemas = [
    organizationSchema(),
    websiteSchema(),
    webPageSchema({ name: page.title, description: page.description, url, dateModified: page.lastModified }),
    breadcrumbSchema([
      { name: 'Beranda', url: siteConfig.url },
      { name: 'Blog', url },
    ]),
    blogSchema({
      name: 'Blog Pusat Valas Indo',
      description: page.description,
      url,
      posts: items.flatMap((p) =>
        p.publishedAt
          ? [{ headline: p.title, url: `${siteConfig.url}/blog/${p.slug}`, datePublished: p.publishedAt.toISOString() }]
          : []
      ),
    }),
  ];

  return (
    <InnerPage id="blog" schemas={schemas}>
      <PageIntro
        crumbs={[{ name: 'Beranda', href: '/' }, { name: 'Blog' }]}
        eyebrow="Blog"
        title={<>Panduan &amp; tips seputar <em className="not-italic text-lp-red-700">valas</em></>}
        lead="Cara tukar uang yang aman, membaca kurs, hingga kirim uang ke luar negeri — ditulis oleh tim money changer berizin Bank Indonesia."
      />

      <Section tone="paper">
        {items.length === 0 ? (
          <p className="max-w-xl text-lg leading-8 text-lp-ink-soft">
            Belum ada artikel yang terbit. Sementara itu, tanyakan kurs hari ini langsung lewat WhatsApp di bawah.
          </p>
        ) : (
          <>
            <CategoryNav
              className="mb-10"
              categories={categories.map((c) => ({ slug: c.slug, name: c.name, count: c._count.posts }))}
            />
            <p className="mb-8 text-sm text-lp-ink-mute">
              {total} artikel{totalPages > 1 ? ` · halaman ${current} dari ${totalPages}` : ''}
            </p>
            {current === 1 && (
              <FeaturedPostCard post={items[0]} className="mb-14 border-b border-lp-line pb-14" />
            )}
            <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
              {(current === 1 ? items.slice(1) : items).map((post) => (
                <PostCard key={post.slug} post={post} />
              ))}
            </div>
            {totalPages > 1 && (
              <nav aria-label="Halaman artikel" className="mt-12 flex items-center justify-between gap-4 text-sm font-semibold">
                {current > 1 ? (
                  <Link
                    href={current === 2 ? '/blog' : `/blog?halaman=${current - 1}`}
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
                    href={`/blog?halaman=${current + 1}`}
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
          </>
        )}
      </Section>
      <RelatedLinks currentPath="/blog" tone="paper2" />
      <FinalCta />
    </InnerPage>
  );
}
