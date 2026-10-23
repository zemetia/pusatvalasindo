import type { BlogPostPublicRow } from '@/backend/repositories/blog-post.repository';
import { Link } from '@/i18n/routing';
import { formatDateLong, formatDateShort } from '@/lib/blog/format';

import { Em, Eyebrow, H2, Section } from './ui';

interface LatestNewsProps {
  posts: BlogPostPublicRow[];
}

export function LatestNews({ posts }: LatestNewsProps) {
  return (
    <Section id="berita" tone="paper2">
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div>
          <Eyebrow>Blog &amp; Edukasi Valas</Eyebrow>
          <H2 className="mt-3 max-w-2xl">
            Artikel &amp; wawasan <Em>valas terbaru.</Em>
          </H2>
          <p className="mt-4 max-w-2xl text-lp-lead text-lp-ink-soft">
            Panduan tukar valas, tips membaca pergerakan kurs, hingga info regulasi kirim uang ke luar negeri — diperbarui berkala oleh tim Pusat Valas Indo.
          </p>
        </div>
        <div className="shrink-0">
          <Link
            href="/blog"
            className="group inline-flex items-center gap-2 rounded-full border border-lp-line bg-lp-paper px-5 py-2.5 text-sm font-semibold text-lp-ink transition-colors hover:border-lp-red-700 hover:text-lp-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lp-red-700"
          >
            <span>Lihat Semua Artikel di Blog</span>
            <span aria-hidden className="transition-transform duration-150 group-hover:translate-x-1">
              →
            </span>
          </Link>
        </div>
      </div>

      {posts.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-lp-line bg-lp-paper p-8 text-center sm:p-12">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-lp-red-700">
            Pusat Edukasi &amp; Informasi
          </p>
          <h3 className="mt-2 font-display text-2xl font-bold text-lp-ink">
            Artikel dan panduan valas akan segera hadir
          </h3>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-lp-ink-soft">
            Kami sedang menyiapkan panduan praktis, tips kurs mata uang, dan informasi valuta asing terpercaya untuk Anda di halaman Blog kami.
          </p>
          <div className="mt-6">
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 rounded-full bg-lp-red-700 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-lp-red-800"
            >
              <span>Buka Halaman Blog</span>
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Artikel Utama / Terbaru #1 */}
          <div className="mt-12 overflow-hidden rounded-2xl border border-lp-line bg-lp-paper transition-shadow duration-300 hover:shadow-lg">
            <article className="group relative grid items-center gap-6 p-6 sm:p-8 lg:grid-cols-[1.15fr_1fr] lg:gap-10">
              <div className="overflow-hidden rounded-xl border border-lp-line bg-lp-paper-2">
                {posts[0].coverImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={posts[0].coverImageUrl}
                    alt={posts[0].coverImageAlt ?? posts[0].title}
                    width={1200}
                    height={630}
                    loading="lazy"
                    decoding="async"
                    className="aspect-[1200/630] w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                  />
                ) : (
                  <div
                    aria-hidden
                    className="lp-red-band aspect-[1200/630] w-full transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                  />
                )}
              </div>

              <div className="flex flex-col">
                <div className="flex flex-wrap items-center gap-2 text-xs text-lp-ink-mute">
                  {posts[0].category && (
                    <span className="rounded-md bg-lp-red-50 px-2.5 py-1 font-semibold uppercase tracking-wider text-lp-red-700">
                      {posts[0].category.name}
                    </span>
                  )}
                  {posts[0].publishedAt && (
                    <time dateTime={posts[0].publishedAt.toISOString()}>
                      {formatDateLong(posts[0].publishedAt)}
                    </time>
                  )}
                  <span aria-hidden>·</span>
                  <span>{posts[0].readingMinutes} menit baca</span>
                </div>

                <h3 className="mt-3 font-display text-[clamp(1.35rem,1.1rem+1.2vw,2rem)] font-bold leading-snug tracking-tight text-lp-ink text-balance transition-colors group-hover:text-lp-red-700">
                  <Link
                    href={`/blog/${posts[0].slug}`}
                    className="after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lp-red-700"
                  >
                    {posts[0].title}
                  </Link>
                </h3>

                <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-lp-ink-soft sm:text-base">
                  {posts[0].excerpt}
                </p>

                <p className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-lp-red-700">
                  Baca artikel{' '}
                  <span aria-hidden className="transition-transform duration-150 group-hover:translate-x-1">
                    →
                  </span>
                </p>
              </div>
            </article>
          </div>

          {/* Sisa Artikel Terbaru (Hingga 4 artikel berikutnya) */}
          {posts.length > 1 && (
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {posts.slice(1, 5).map((post) => (
                <article
                  key={post.id}
                  className="group relative flex flex-col overflow-hidden rounded-2xl border border-lp-line bg-lp-paper p-4 transition-all duration-300 hover:-translate-y-1 hover:border-lp-red-700/40 hover:shadow-md sm:p-5"
                >
                  <div className="overflow-hidden rounded-xl border border-lp-line bg-lp-paper-2">
                    {post.coverImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={post.coverImageUrl}
                        alt={post.coverImageAlt ?? post.title}
                        width={1200}
                        height={630}
                        loading="lazy"
                        decoding="async"
                        className="aspect-[1200/630] w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                      />
                    ) : (
                      <div
                        aria-hidden
                        className="lp-red-band aspect-[1200/630] w-full transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                      />
                    )}
                  </div>

                  <div className="mt-4 flex flex-1 flex-col">
                    <div className="flex flex-wrap items-center gap-x-2 text-xs text-lp-ink-mute">
                      {post.category && (
                        <span className="font-semibold uppercase tracking-wider text-lp-red-700">
                          {post.category.name}
                        </span>
                      )}
                      {post.category && <span aria-hidden>·</span>}
                      {post.publishedAt && (
                        <time dateTime={post.publishedAt.toISOString()}>
                          {formatDateShort(post.publishedAt)}
                        </time>
                      )}
                    </div>

                    <h3 className="mt-2.5 font-display text-base font-bold leading-snug tracking-tight text-lp-ink text-balance transition-colors group-hover:text-lp-red-700">
                      <Link
                        href={`/blog/${post.slug}`}
                        className="after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lp-red-700"
                      >
                        {post.title}
                      </Link>
                    </h3>

                    <p className="mt-2.5 line-clamp-2 text-xs leading-relaxed text-lp-ink-soft sm:text-[0.875rem]">
                      {post.excerpt}
                    </p>

                    <div className="mt-auto flex items-center justify-between pt-4 text-xs font-semibold text-lp-ink-mute">
                      <span>{post.readingMinutes} mnt baca</span>
                      <span className="inline-flex items-center gap-1 text-lp-red-700 transition-transform duration-150 group-hover:translate-x-0.5">
                        Baca <span aria-hidden>→</span>
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          {/* Banner Arahkan ke /blog */}
          <div className="mt-12 flex flex-col items-start justify-between gap-6 rounded-2xl border border-lp-line bg-lp-paper p-6 sm:flex-row sm:items-center sm:p-8">
            <div>
              <p className="font-display text-lg font-bold text-lp-ink">
                Ingin membaca lebih banyak panduan &amp; tips valas?
              </p>
              <p className="mt-1 text-sm text-lp-ink-soft">
                Kunjungi halaman Blog untuk membaca seluruh artikel kurs, tips penukaran, dan panduan keuangan kami.
              </p>
            </div>
            <Link
              href="/blog"
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-lp-red-700 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-lp-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lp-red-700"
            >
              <span>Kunjungi Halaman Blog</span>
              <span aria-hidden>→</span>
            </Link>
          </div>
        </>
      )}
    </Section>
  );
}
