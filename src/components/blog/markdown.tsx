import { Children, isValidElement, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { Link } from "@/i18n/routing";
import { slugify } from "@/lib/blog/slug";
import { cn } from "@/lib/utils";

/** Teks polos dari anak-anak elemen heading — dipakai untuk membuat id anchor. */
function textOf(node: ReactNode): string {
  return Children.toArray(node)
    .map((child) => {
      if (typeof child === "string" || typeof child === "number") return String(child);
      if (isValidElement<{ children?: ReactNode }>(child)) return textOf(child.props.children);
      return "";
    })
    .join("");
}

const isInternal = (href: string) => href.startsWith("/") && !href.startsWith("//");

const H2 = "mt-14 scroll-mt-24 font-display text-[1.625rem] font-bold leading-tight tracking-[-0.02em] text-lp-ink sm:text-[1.875rem]";
const H3 = "mt-10 scroll-mt-24 font-display text-xl font-bold leading-snug tracking-[-0.01em] text-lp-ink sm:text-[1.375rem]";
const BODY = "text-[1.0625rem] leading-[1.85] text-lp-ink-soft";

/**
 * Peta elemen → gaya situs publik.
 *
 * h1 di dalam isi artikel diturunkan menjadi h2: judul artikel sudah menjadi
 * satu-satunya <h1> halaman, dan dua <h1> merusak struktur heading untuk SEO
 * maupun pembaca layar.
 */
const components: Components = {
  h1: ({ children }) => (
    <h2 id={slugify(textOf(children)) || undefined} className={H2}>
      {children}
    </h2>
  ),
  h2: ({ children }) => (
    <h2 id={slugify(textOf(children)) || undefined} className={H2}>
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 id={slugify(textOf(children)) || undefined} className={H3}>
      {children}
    </h3>
  ),
  h4: ({ children }) => <h4 className="mt-8 text-lg font-semibold text-lp-ink">{children}</h4>,
  p: ({ children }) => <p className={cn("mt-6", BODY)}>{children}</p>,
  a: ({ href, children }) => {
    const cls =
      "font-medium text-lp-red-700 underline decoration-lp-red-200 decoration-2 underline-offset-[5px] transition-colors hover:decoration-lp-red-700";
    if (!href) return <span>{children}</span>;
    if (isInternal(href)) {
      return (
        <Link href={href} className={cls}>
          {children}
        </Link>
      );
    }
    if (/^https?:\/\//i.test(href)) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
          {children}
        </a>
      );
    }
    return (
      <a href={href} className={cls}>
        {children}
      </a>
    );
  },
  ul: ({ children, className }) => (
    <ul
      className={cn(
        "mt-6 space-y-2.5",
        BODY,
        className?.includes("contains-task-list") ? "list-none pl-0" : "list-disc pl-6 marker:text-lp-red-700"
      )}
    >
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className={cn("mt-6 list-decimal space-y-2.5 pl-6 marker:font-semibold marker:text-lp-red-700", BODY)}>{children}</ol>
  ),
  li: ({ children, className }) => (
    <li className={cn("pl-1 [&>ol]:mt-2.5 [&>p]:mt-0 [&>ul]:mt-2.5", className?.includes("task-list-item") && "flex items-start gap-2.5 pl-0")}>
      {children}
    </li>
  ),
  input: ({ checked }) => (
    <span
      aria-hidden
      className={cn(
        "mt-[0.55rem] flex size-4 shrink-0 items-center justify-center rounded border text-[10px] leading-none",
        checked ? "border-lp-red-700 bg-lp-red-700 text-white" : "border-lp-ink-mute bg-white"
      )}
    >
      {checked ? "✓" : ""}
    </span>
  ),
  blockquote: ({ children }) => (
    <blockquote className="mt-8 rounded-r-xl border-l-[3px] border-lp-red-700 bg-lp-paper-2 px-6 py-1 font-display text-lg leading-8 text-lp-ink [&>p]:mt-4 [&>p]:mb-4 [&>p]:text-lp-ink [&>p]:text-lg [&>p]:leading-8">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-12 border-lp-line" />,
  strong: ({ children }) => <strong className="font-semibold text-lp-ink">{children}</strong>,
  img: ({ src, alt }) => (
    // Gambar di dalam isi artikel bisa dari host mana pun, sehingga tidak bisa lewat next/image
    // (remotePatterns kosong). Dimensi tidak diketahui → h-auto + lazy. Pakai <span> (bukan <figure>)
    // karena Markdown membungkus gambar dalam <p>.
    <span className="mt-8 block">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={typeof src === "string" ? src : undefined}
        alt={alt ?? ""}
        loading="lazy"
        decoding="async"
        className="h-auto w-full rounded-2xl border border-lp-line bg-lp-paper-2"
      />
      {alt && <span className="mt-3 block text-center text-sm text-lp-ink-mute">{alt}</span>}
    </span>
  ),
  table: ({ children }) => (
    <div className="mt-8 overflow-x-auto rounded-2xl border border-lp-line">
      <table className="w-full min-w-[32rem] border-collapse text-left text-[0.9375rem]">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-lp-paper-2 text-xs uppercase tracking-wide text-lp-ink-soft">{children}</thead>,
  th: ({ children }) => <th className="border-b border-lp-line px-4 py-3 font-semibold">{children}</th>,
  td: ({ children }) => <td className="border-b border-lp-line px-4 py-3 text-lp-ink-soft [tr:last-child>&]:border-b-0">{children}</td>,
  pre: ({ children }) => (
    <pre className="mt-8 overflow-x-auto rounded-2xl bg-lp-night p-5 text-sm leading-7 text-white/90 [&>code]:border-0 [&>code]:bg-transparent [&>code]:p-0 [&>code]:text-inherit">
      {children}
    </pre>
  ),
  code: ({ children, className }) => (
    <code className={cn("rounded-md border border-lp-line bg-lp-paper-2 px-1.5 py-0.5 font-mono text-[0.88em] text-lp-ink", className)}>
      {children}
    </code>
  ),
};

/**
 * Merender Markdown artikel. HTML mentah di dalam Markdown TIDAK dirender
 * (react-markdown menampilkannya sebagai teks) dan protokol berbahaya seperti
 * `javascript:` dinetralkan — jadi isi artikel aman ditampilkan apa adanya
 * tanpa sanitizer tambahan.
 */
export function Markdown({ content, className }: { content: string; className?: string }) {
  return (
    <div className={cn("article-body markdown-content min-w-0 [&>*:first-child]:mt-0", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
