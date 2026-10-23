import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { cache } from 'react';

import { blogService } from '@/backend/services/blog.service';
import { siteConfig } from '@/config/site';
import { FinalCta } from '@/components/landing/sections';
import { Breadcrumbs } from '@/components/landing/page-intro';
import { InnerPage, RelatedLinks } from '@/components/landing/page-sections';
import { Container, Eyebrow, H2, Section } from '@/components/landing/ui';
import { BlogFeedback } from '@/components/blog/blog-feedback';
import { Markdown } from '@/components/blog/markdown';
import { PostCard } from '@/components/blog/post-card';
import { ViewCounter } from '@/components/blog/view-counter';
import { Link, routing } from '@/i18n/routing';
import { countWords, extractFaqs, extractHeadings } from '@/lib/blog/content';
import { formatDateLong } from '@/lib/blog/format';
import { buildMetadata } from '@/lib/seo';
import {
  blogPostingSchema,
  breadcrumbSchema,
  faqSchema,
  organizationSchema,
  webPageSchema,
  websiteSchema,
} from '@/lib/structured-data';

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

  const baseKeywords = [
    'tukar valas',
    'money changer jakarta',
    'pusat valas indo',
    'kurs valas hari ini',
    'tukar uang online',
  ];
  const keywords = Array.from(
    new Set([
      ...(post.category ? [post.category.name] : []),
      ...baseKeywords,
    ])
  );

  const meta = buildMetadata({
    title: seoTitle(post.title, post.metaTitle),
    description: post.metaDescription ?? post.excerpt,
    path: `/blog/${post.slug}`,
    locale,
    ogImage: post.coverImageUrl ?? undefined,
    keywords,
    noIndex: !siteConfig.contentLocales.includes(locale),
  });

  return {
    ...meta,
    openGraph: {
      ...meta.openGraph,
      type: 'article',
      publishedTime: post.publishedAt?.toISOString(),
      modifiedTime: post.updatedAt.toISOString(),
      authors: [siteConfig.name],
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

  const toc = extractHeadings(post.content);
  const articleFaqs = extractFaqs(post.content);
  const related = await blogService.getRelatedPosts(post.id, post.categoryId, 3);

  const baseKeywords = [
    'tukar valas',
    'money changer jakarta',
    'pusat valas indo',
    'kurs valas hari ini',
    'tukar uang online',
  ];
  const keywords = Array.from(
    new Set([
      ...(post.category ? [post.category.name] : []),
      ...baseKeywords,
    ])
  );

  const url = `${siteConfig.url}/blog/${post.slug}`;
  const published = post.publishedAt ?? post.createdAt;
  const description = post.metaDescription ?? post.excerpt;
  const schemas = [
    organizationSchema(),
    websiteSchema(),
    webPageSchema({
      name: post.title,
      description,
      url,
      datePublished: published.toISOString(),
      dateModified: post.updatedAt.toISOString(),
      speakable: {
        cssSelector: ['h1', '.article-lead'],
      },
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
      keywords,
    }),
    ...(articleFaqs.length > 0
      ? [faqSchema(articleFaqs.map((f) => ({ question: f.question, answer: f.answer })))]
      : []),
  ];

  return (
    <InnerPage id={`blog-${post.slug}`} schemas={schemas}>
      <article>
        <header className="border-b border-lp-line bg-lp-paper text-lp-ink">
          <Container className="py-[clamp(2.5rem,2rem+3vw,5rem)]">
            <Breadcrumbs
              items={[{ name: 'Beranda', href: '/' }, { name: 'Blog', href: '/blog' }, { name: post.title }]}
            />
            <div className="lp-rise mx-auto mt-10 max-w-3xl text-center">
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
              <p className="article-lead mx-auto mt-6 max-w-2xl text-lp-lead leading-8 text-lp-ink-soft text-pretty">{post.excerpt}</p>
              <p className="mt-8 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-lp-ink-mute">
                <span>Oleh Tim {siteConfig.name}</span>
                <span aria-hidden>·</span>
                <time dateTime={published.toISOString()}>{formatDateLong(published)}</time>
                <span aria-hidden>·</span>
                <span>{post.readingMinutes} menit baca</span>
                <span aria-hidden>·</span>
                <ViewCounter postId={post.id} initialCount={post.viewCount} />
              </p>
              {post.updatedAt.getTime() - published.getTime() > 24 * 3600_000 && (
                <p className="mt-1 text-sm text-lp-ink-mute">
                  Diperbarui <time dateTime={post.updatedAt.toISOString()}>{formatDateLong(post.updatedAt)}</time>
                </p>
              )}
            </div>
          </Container>
        </header>

        <Section tone="paper" className="!py-[clamp(2rem,1.5rem+3vw,4.5rem)]">
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
              className="mx-auto mb-12 aspect-[1200/630] w-full max-w-4xl rounded-2xl border border-lp-line bg-lp-paper-2 object-cover"
            />
          )}
          <div className="mx-auto grid max-w-3xl gap-12 xl:max-w-5xl xl:grid-cols-[minmax(0,44rem)_13rem] xl:justify-between">
            <div className="min-w-0">
              <Markdown content={post.content} />
              <BlogFeedback
                postId={post.id}
                initialUpvotes={post.upvoteCount}
                initialDownvotes={post.downvoteCount}
              />
            </div>
            {toc.length >= 3 && (
              <aside className="hidden xl:block">
                <nav aria-label="Daftar isi" className="sticky top-28 border-l border-lp-line pl-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-lp-ink-mute">Di artikel ini</p>
                  <ul className="mt-4 space-y-3 text-sm leading-snug">
                    {toc.map((h) => (
                      <li key={h.id} className={h.level === 3 ? 'pl-3' : undefined}>
                        <a href={`#${h.id}`} className="text-lp-ink-soft transition-colors hover:text-lp-red-700">
                          {h.text}
                        </a>
                      </li>
                    ))}
                  </ul>
                </nav>
              </aside>
            )}
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

      <RelatedLinks currentPath="/blog" tone="paper" />
      <FinalCta />
    </InnerPage>
  );
}
