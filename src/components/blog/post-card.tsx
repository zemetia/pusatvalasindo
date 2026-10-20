import { Link } from "@/i18n/routing";
import { formatDateLong } from "@/lib/blog/format";

export interface PostCardData {
  slug: string;
  title: string;
  excerpt: string;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  publishedAt: Date | null;
  readingMinutes: number;
  category: { name: string } | null;
}

/** Kartu artikel untuk indeks blog & "artikel terkait". Seluruh kartu satu tautan. */
export function PostCard({ post, headingLevel = 2 }: { post: PostCardData; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-[var(--lp-radius-lg)] border border-lp-line bg-white transition-shadow hover:shadow-lg focus-within:shadow-lg">
      {post.coverImageUrl ? (
        // Host gambar sampul bebas, jadi tidak lewat next/image (remotePatterns kosong).
        // Rasio dikunci lewat aspect-ratio supaya tidak ada layout shift.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.coverImageUrl}
          alt={post.coverImageAlt ?? ""}
          width={1200}
          height={630}
          loading="lazy"
          decoding="async"
          className="aspect-[1200/630] w-full bg-lp-paper-2 object-cover"
        />
      ) : (
        <div aria-hidden className="lp-red-band aspect-[1200/630] w-full" />
      )}
      <div className="flex flex-1 flex-col p-6">
        {post.category && (
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-lp-red-700">{post.category.name}</p>
        )}
        <Heading className="mt-2 font-display text-xl font-bold leading-snug tracking-tight text-lp-ink text-balance">
          <Link
            href={`/blog/${post.slug}`}
            className="after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lp-red-700"
          >
            {post.title}
          </Link>
        </Heading>
        <p className="mt-3 line-clamp-3 text-[0.9375rem] leading-7 text-lp-ink-soft">{post.excerpt}</p>
        <p className="mt-auto pt-5 text-xs text-lp-ink-mute">
          {post.publishedAt && <time dateTime={post.publishedAt.toISOString()}>{formatDateLong(post.publishedAt)}</time>}
          <span aria-hidden> · </span>
          {post.readingMinutes} menit baca
        </p>
      </div>
    </article>
  );
}
