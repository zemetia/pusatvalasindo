import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { cache } from 'react';

import { blogService } from '@/backend/services/blog.service';
import { siteConfig } from '@/config/site';
import { FinalCta } from '@/components/landing/sections';
import { Breadcrumbs } from '@/components/landing/page-intro';
import { InnerPage } from '@/components/landing/page-sections';
import { Container, Eyebrow, H2, Section } from '@/components/landing/ui';
import { Markdown } from '@/components/blog/markdown';
import { PostCard } from '@/components/blog/post-card';
import { ViewTracker } from '@/components/blog/view-tracker';
import { Link, routing } from '@/i18n/routing';
import { countWords } from '@/lib/blog/content';
import { formatDateLong } from '@/lib/blog/format';
import { buildMetadata } from '@/lib/seo';
import { blogPostingSchema, breadcrumbSchema, webPageSchema } from '@/lib/structured-data';

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

// Dipakai bersama generateMetadata & halaman dalam satu request.
const getPost = cache((slug: string) => blogService.getLivePost(slug));

const localePrefix = (locale: string) => (locale === routing.defaultLocale ? '' : `/${locale}`);

/** Judul tab/SERP: akhiran brand hanya bila masih muat (≤ 65 karakter), supaya tidak terpotong. */
function seoTitle(title: string, metaTitle: string | null): string {
  const base = metaTitle ?? title;
  const withBrand = `${base} | ${siteConfig.name}`;
  return withBrand.length <= 65 ? withBrand : base;
}

const absolute = (url: string) => (url.startsWith('/') ? `${siteConfig.url}${url}` : url);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const post = await getPost(slug);
  // Slug lama / tidak ada: halamannya akan redirect atau 404 — tidak perlu metadata.
  if (!post) return {};

  const meta = buildMetadata({
    title: seoTitle(post.title, post.metaTitle),
    description: post.metaDescription ?? post.excerpt,
    path: `/blog/${post.slug}`,
    locale,
    ogImage: post.coverImageUrl ?? undefined,
    noIndex: !siteConfig.contentLocales.includes(locale),
  });

  return {
    ...meta,
    openGraph: {
      ...meta.openGraph,
      type: 'article',
      publishedTime: post.publishedAt?.toISOString(),
      modifiedTime: post.updatedAt.toISOString(),
      ...(post.category ? { section: post.category.name } : {}),
    } as Metadata['openGraph'],
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { locale, slug } = await params;
  const post = await getPost(slug);

  if (!post) {
    // Slug yang pernah dipakai artikel yang masih tayang → 301 ke slug barunya,
    // supaya URL yang sudah terindeks/tersebar tidak menjadi 404.
    const target = await blogService.resolveRedirect(slug);
    if (target) permanentRedirect(`${localePrefix(locale)}/blog/${target}`);
    notFound();
  }

  const related = await blogService.getRelatedPosts(post.id, post.categoryId, 3);

  const url = `${siteConfig.url}/blog/${post.slug}`;
  const published = post.publishedAt ?? post.createdAt;
  const description = post.metaDescription ?? post.excerpt;
  const schemas = [
    webPageSchema({
      name: post.title,
      description,
      url,
      datePublished: published.toISOString(),
      dateModified: post.updatedAt.toISOString(),
    }),
    breadcrumbSchema([
      { name: 'Beranda', url: siteConfig.url },
      { name: 'Blog', url: `${siteConfig.url}/blog` },
      { name: post.title, url },
    ]),
    blogPostingSchema({
      headline: post.title,
      description,
      url,
      datePublished: published.toISOString(),
      dateModified: post.updatedAt.toISOString(),
      image: post.coverImageUrl ? absolute(post.coverImageUrl) : undefined,
      section: post.category?.name,
      wordCount: countWords(post.content),
    }),
  ];

  return (
    <InnerPage id={`blog-${post.slug}`} schemas={schemas}>
      <article>
        <header className="border-b border-lp-line bg-lp-paper text-lp-ink">
          <Container className="py-[clamp(2.5rem,2rem+3vw,5rem)]">
            <Breadcrumbs
              items={[{ name: 'Beranda', href: '/' }, { name: 'Blog', href: '/blog' }, { name: post.title }]}
            />
            <div className="lp-rise mt-10 max-w-3xl">
              {post.category && (
                <Eyebrow>
                  <Link href={`/blog/kategori/${post.category.slug}`} className="underline-offset-4 hover:underline">
                    {post.category.name}
                  </Link>
                </Eyebrow>
              )}
              <h1 className="mt-4 font-display text-[clamp(2rem,1.2rem+3vw,3.5rem)] font-bold leading-[1.08] tracking-[-0.03em] text-balance">
                {post.title}
              </h1>
              <p className="mt-6 text-lp-lead leading-8 text-lp-ink-soft text-pretty">{post.excerpt}</p>
              <p className="mt-6 text-sm text-lp-ink-mute">
                Oleh Tim {siteConfig.name} <span aria-hidden>·</span>{' '}
                <time dateTime={published.toISOString()}>{formatDateLong(published)}</time> <span aria-hidden>·</span>{' '}
                {post.readingMinutes} menit baca
              </p>
              {post.updatedAt.getTime() - published.getTime() > 24 * 3600_000 && (
                <p className="mt-1 text-sm text-lp-ink-mute">
                  Diperbarui <time dateTime={post.updatedAt.toISOString()}>{formatDateLong(post.updatedAt)}</time>
                </p>
              )}
            </div>
          </Container>
        </header>

        <Section tone="paper" className="!py-[clamp(2.5rem,2rem+3vw,5rem)]">
          <div className="mx-auto max-w-3xl">
            {post.coverImageUrl && (
              // Host sampul bebas → <img> biasa (lihat PostCard); fetchpriority tinggi karena ini LCP halaman.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={post.coverImageUrl}
                alt={post.coverImageAlt ?? post.title}
                width={1200}
                height={630}
                fetchPriority="high"
                decoding="async"
                className="mb-10 aspect-[1200/630] w-full rounded-[var(--lp-radius-lg)] border border-lp-line bg-lp-paper-2 object-cover"
              />
            )}
            <Markdown content={post.content} />
          </div>
        </Section>
      </article>

      {related.length > 0 && (
        <Section tone="paper2">
          <H2 className="max-w-3xl">Baca juga</H2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((r) => (
              <PostCard key={r.slug} post={r} headingLevel={3} />
            ))}
          </div>
        </Section>
      )}

      <FinalCta />
      <ViewTracker postId={post.id} />
    </InnerPage>
  );
}
