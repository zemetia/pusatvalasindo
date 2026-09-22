import Image from 'next/image';
import { UserRound } from 'lucide-react';
import { Link } from '@/i18n/routing';

import { branches } from '@/config/group';
import { nav } from '@/content/landing';

import { HoursBadge } from './hours-badge';
import { Container, WhatsAppButton } from './ui';

const hq = branches[0];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-lp-line bg-lp-paper/90 backdrop-blur">
      <Container className="flex h-16 items-center justify-between gap-6">
        <Link href="/" aria-label="Pusat Valas Indo, beranda">
          <Image src="/images/logo/logo-red.png" alt="Pusat Valas Indo" width={358} height={108} className="h-9 w-auto" priority />
        </Link>
        <nav aria-label="Utama" className="hidden items-center gap-8 md:flex">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="text-sm font-medium text-lp-ink-soft transition-colors hover:text-lp-red-700">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-4">
          <HoursBadge hours={hq.hours} className="hidden text-lp-ink-mute lg:inline-flex" />
          <WhatsAppButton number={hq.whatsapp} text="Halo, saya mau tanya kurs hari ini." className="px-4 py-2">
            WhatsApp
          </WhatsAppButton>
          <Link
            href="/login"
            aria-label="Login admin"
            title="Login admin"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-lp-line text-lp-ink-soft transition-colors hover:border-lp-red-700 hover:text-lp-red-700"
          >
            <UserRound className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </Container>
    </header>
  );
}
