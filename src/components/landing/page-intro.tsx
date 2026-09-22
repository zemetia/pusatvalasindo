import type { ReactNode } from 'react';

import { Link } from '@/i18n/routing';

import { Container, Eyebrow } from './ui';

export interface Crumb {
  name: string;
  /** Path tanpa prefix locale. Crumb terakhir (halaman ini) tidak diberi href. */
  href?: string;
}

/** Breadcrumb terlihat; datanya sama dengan `breadcrumbSchema` di halaman. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-lp-ink-mute">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {items.map((c, i) => (
          <li key={c.name} className="flex items-center gap-2">
            {c.href ? (
              <Link href={c.href} className="hover:text-lp-red-700 hover:underline underline-offset-4">
                {c.name}
              </Link>
            ) : (
              <span aria-current="page" className="text-lp-ink-soft">
                {c.name}
              </span>
            )}
            {i < items.length - 1 && <span aria-hidden>/</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Pembuka halaman dalam: satu H1, paragraf pembuka yang bisa dikutip berdiri sendiri, aksi. */
export function PageIntro({
  crumbs,
  eyebrow,
  title,
  lead,
  children,
}: {
  crumbs: Crumb[];
  eyebrow: string;
  title: ReactNode;
  lead: ReactNode;
  /** Tombol / info tambahan di bawah lead */
  children?: ReactNode;
}) {
  return (
    <section className="border-b border-lp-line bg-lp-paper text-lp-ink">
      <Container className="py-[clamp(2.5rem,2rem+3vw,5rem)]">
        <Breadcrumbs items={crumbs} />
        <div className="lp-rise mt-10 max-w-3xl">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 className="mt-4 font-display text-lp-h2 font-bold leading-[1.02] tracking-[-0.03em] text-balance">
            {title}
          </h1>
          <p className="mt-6 max-w-2xl text-lp-lead leading-[1.55] text-lp-ink-soft">{lead}</p>
          {children && <div className="mt-8 flex flex-wrap items-center gap-3">{children}</div>}
        </div>
      </Container>
    </section>
  );
}
