import { Link } from "@/i18n/routing";
import { formatDateLong, formatInt } from "@/lib/blog/format";
import { cn } from "@/lib/utils";

export interface PostCardData {
  slug: string;
  title: string;
  excerpt: string;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  publishedAt: Date | null;
  readingMinutes: number;
  viewCount?: number;
  upvoteCount?: number;
  downvoteCount?: number;
  category: { name: string } | null;
}

function Cover({ post, eager }: { post: PostCardData; eager?: boolean }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-lp-line bg-lp-paper-2">
      {post.coverImageUrl ? (
        // Host gambar sampul bebas, jadi tidak lewat next/image (remotePatterns kosong).
        // Rasio dikunci lewat aspect-ratio supaya tidak ada layout shift.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.coverImageUrl}
          alt={post.coverImageAlt ?? ""}
          width={1200}
          height={630}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          className="aspect-[1200/630] w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
        />
      ) : (
        <div aria-hidden className="lp-red-band aspect-[1200/630] w-full transition-transform duration-500 ease-out group-hover:scale-[1.03]" />
      )}
    </div>
  );
}

function Meta({ post }: { post: PostCardData }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 text-xs text-lp-ink-mute">
      {post.category && <span className="font-semibold uppercase tracking-[0.12em] text-lp-red-700">{post.category.name}</span>}
      {post.category && <span aria-hidden>·</span>}
      {post.publishedAt && <time dateTime={post.publishedAt.toISOString()}>{formatDateLong(post.publishedAt)}</time>}
      <span aria-hidden>·</span>
      <span>{post.readingMinutes} menit baca</span>
      {typeof post.viewCount === "number" && (
        <>
          <span aria-hidden>·</span>
          <span>{formatInt(post.viewCount)} dilihat</span>
        </>
      )}
    </p>
  );
}

const LINK =
  "after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lp-red-700";

/** Kartu artikel untuk indeks blog & "artikel terkait". Seluruh kartu satu tautan. */
export function PostCard({ post, headingLevel = 2 }: { post: PostCardData; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <article className="group relative flex flex-col">
      <Cover post={post} />
      <div className="mt-5 flex flex-1 flex-col">
        <Meta post={post} />
        <Heading className="mt-2.5 font-display text-xl font-bold leading-snug tracking-tight text-lp-ink text-balance transition-colors group-hover:text-lp-red-700">
          <Link href={`/blog/${post.slug}`} className={LINK}>
            {post.title}
          </Link>
        </Heading>
        <p className="mt-3 line-clamp-3 text-[0.9375rem] leading-7 text-lp-ink-soft">{post.excerpt}</p>
      </div>
    </article>
  );
}

/** Artikel unggulan: gambar besar di kiri, teks di kanan (desktop). Dipakai untuk artikel terbaru di halaman 1. */
export function FeaturedPostCard({ post, className }: { post: PostCardData; className?: string }) {
  return (
    <article className={cn("group relative grid items-center gap-6 lg:grid-cols-[1.15fr_1fr] lg:gap-12", className)}>
      <Cover post={post} eager />
      <div>
        <Meta post={post} />
        <h2 className="mt-3 font-display text-[clamp(1.625rem,1.2rem+1.6vw,2.5rem)] font-bold leading-[1.12] tracking-[-0.025em] text-lp-ink text-balance transition-colors group-hover:text-lp-red-700">
          <Link href={`/blog/${post.slug}`} className={LINK}>
            {post.title}
          </Link>
        </h2>
        <p className="mt-4 line-clamp-4 text-base leading-7 text-lp-ink-soft">{post.excerpt}</p>
        <p className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-lp-red-700">
          Baca artikel <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
        </p>
      </div>
    </article>
  );
}
