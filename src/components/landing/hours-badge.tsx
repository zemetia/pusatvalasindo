'use client';

import { useEffect, useState } from 'react';

import type { OpeningHours } from '@/config/group';
import { getOpeningStatus, type OpeningStatus } from '@/lib/opening-status';
import { cn } from '@/lib/utils';

/** Dihitung di klien (jam WIB) supaya tidak beku saat halaman di-cache. */
export function HoursBadge({ hours, className }: { hours: OpeningHours[]; className?: string }) {
  const [status, setStatus] = useState<OpeningStatus | null>(null);

  useEffect(() => {
    const tick = () => setStatus(getOpeningStatus(hours));
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [hours]);

  if (!status) return <span className={cn('inline-block h-5 w-32', className)} aria-hidden />;

  return (
    <span className={cn('inline-flex items-center gap-2 text-sm', className)}>
      <span
        aria-hidden
        className={cn('size-2 rounded-full', status.open ? 'bg-emerald-500' : 'bg-neutral-400')}
      />
      {status.label}
    </span>
  );
}
