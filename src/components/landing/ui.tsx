import type { ReactNode } from 'react';

import { whatsappUrl } from '@/config/group';
import { cn } from '@/lib/utils';

export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('mx-auto w-full max-w-[72rem] px-[clamp(1rem,4vw,2rem)]', className)}>
      {children}
    </div>
  );
}

export function Section({
  id,
  tone = 'paper',
  className,
  children,
}: {
  id?: string;
  tone?: 'paper' | 'paper2' | 'night' | 'red';
  className?: string;
  children: ReactNode;
}) {
  const tones = {
    paper: 'bg-lp-paper text-lp-ink',
    paper2: 'bg-lp-paper-2 text-lp-ink',
    night: 'bg-lp-night text-white',
    red: 'lp-red-band text-white',
  };
  return (
    <section
      id={id}
      className={cn('scroll-mt-20 py-[clamp(4.5rem,3rem+7vw,9rem)]', tones[tone], className)}
    >
      <Container>{children}</Container>
    </section>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn('text-xs font-semibold uppercase tracking-[0.12em] text-lp-red-700', className)}>
      {children}
    </p>
  );
}

export function H2({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h2
      className={cn(
        'font-display text-lp-h2 font-bold leading-[1.02] tracking-[-0.03em] text-balance',
        className,
      )}
    >
      {children}
    </h2>
  );
}

/** Kata yang di-highlight merah di dalam headline. */
export function Em({ children }: { children: ReactNode }) {
  return <em className="not-italic text-lp-red-700">{children}</em>;
}

export function WhatsAppButton({
  number,
  text,
  children,
  variant = 'primary',
  className,
}: {
  number: string;
  text?: string;
  children: ReactNode;
  variant?: 'primary' | 'outline' | 'onRed';
  className?: string;
}) {
  const styles = {
    primary: 'bg-lp-red-700 text-white hover:bg-lp-red-800',
    outline: 'border border-lp-ink/80 text-lp-ink hover:bg-lp-ink hover:text-white',
    onRed: 'bg-white text-lp-red-800 hover:bg-lp-red-50',
  };
  return (
    <a
      href={whatsappUrl(number, text)}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'group inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold',
        'transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lp-red-700',
        styles[variant],
        className,
      )}
    >
      {children}
      <span aria-hidden className="transition-transform duration-150 group-hover:translate-x-0.5">→</span>
    </a>
  );
}

export function CurrencyChip({ code, className }: { code: string; className?: string }) {
  return (
    <span className={cn('font-mono text-sm font-semibold tracking-wider', className)}>{code}</span>
  );
}
