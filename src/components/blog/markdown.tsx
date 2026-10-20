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

/**
 * Peta elemen → gaya situs publik.
 *
 * h1 di dalam isi artikel diturunkan menjadi h2: judul artikel sudah menjadi
 * satu-satunya <h1> halaman, dan dua <h1> merusak struktur heading untuk SEO
 * maupun pembaca layar.
 */
const components: Components = {
  h1: ({ children }) => (
    <h2 id={slugify(textOf(children)) || undefined} className="mt-12 scroll-mt-24 font-display text-2xl font-bold tracking-tight text-lp-ink sm:text-3xl">
      {children}
    </h2>
  ),
  h2: ({ children }) => (
    <h2 id={slugify(textOf(children)) || undefined} className="mt-12 scroll-mt-24 font-display text-2xl font-bold tracking-tight text-lp-ink sm:text-3xl">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 id={slugify(textOf(children)) || undefined} className="mt-8 scroll-mt-24 font-display text-xl font-bold tracking-tight text-lp-ink sm:text-2xl">
      {children}
    </h3>
  ),
  h4: ({ children }) => <h4 className="mt-6 text-lg font-semibold text-lp-ink">{children}</h4>,
  p: ({ children }) => <p className="mt-5 text-[1.0625rem] leading-8 text-lp-ink-soft">{children}</p>,
  a: ({ href, children }) => {
    const cls = "font-medium text-lp-red-700 underline underline-offset-4 hover:text-lp-red-800";
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
  ul: ({ children }) => <ul className="mt-5 list-disc space-y-2 pl-6 text-[1.0625rem] leading-8 text-lp-ink-soft marker:text-lp-red-700">{children}</ul>,
  ol: ({ children }) => <ol className="mt-5 list-decimal space-y-2 pl-6 text-[1.0625rem] leading-8 text-lp-ink-soft marker:font-semibold marker:text-lp-red-700">{children}</ol>,
  li: ({ children }) => <li className="pl-1">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="mt-6 border-l-4 border-lp-red-700 bg-lp-paper-2 py-1 pl-5 pr-4 text-lp-ink-soft [&>p]:mt-3">{children}</blockquote>
  ),
  hr: () => <hr className="my-10 border-lp-line" />,
  strong: ({ children }) => <strong className="font-semibold text-lp-ink">{children}</strong>,
  img: ({ src, alt }) => (
    // Gambar di dalam isi artikel bisa dari host mana pun, sehingga tidak bisa lewat next/image
    // (remotePatterns kosong). Dimensi tidak diketahui → h-auto + lazy.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={typeof src === "string" ? src : undefined} alt={alt ?? ""} loading="lazy" decoding="async" className="mt-6 h-auto w-full rounded-xl border border-lp-line" />
  ),
  table: ({ children }) => (
    <div className="mt-6 overflow-x-auto rounded-xl border border-lp-line">
      <table className="w-full min-w-[32rem] border-collapse text-left text-[0.9375rem]">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-lp-paper-2 text-lp-ink">{children}</thead>,
  th: ({ children }) => <th className="border-b border-lp-line px-4 py-3 font-semibold">{children}</th>,
  td: ({ children }) => <td className="border-b border-lp-line px-4 py-3 text-lp-ink-soft">{children}</td>,
  pre: ({ children }) => (
    <pre className="mt-6 overflow-x-auto rounded-xl bg-lp-night p-4 text-sm leading-7 text-white [&>code]:bg-transparent [&>code]:p-0 [&>code]:text-inherit">{children}</pre>
  ),
  code: ({ children, className }) => (
    <code className={cn("rounded bg-lp-paper-2 px-1.5 py-0.5 font-mono text-[0.9em] text-lp-ink", className)}>{children}</code>
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
    <div className={cn("min-w-0 [&>*:first-child]:mt-0", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
