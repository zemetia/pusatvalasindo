import { jakartaDay } from "./tracking";

export const RANGE_OPTIONS = [7, 30, 90] as const;
export type RangeDays = (typeof RANGE_OPTIONS)[number];
export const DEFAULT_RANGE: RangeDays = 30;

const DAY_MS = 86_400_000;
const JAKARTA_OFFSET_MS = 7 * 3600_000;

export function parseRangeDays(raw: unknown): RangeDays {
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  return (RANGE_OPTIONS as readonly number[]).includes(n) ? (n as RangeDays) : DEFAULT_RANGE;
}

/** Instan UTC dari 00:00 WIB pada tanggal WIB milik `d`. */
export function jakartaStartOfDay(d: Date): Date {
  const [y, m, day] = jakartaDay(d).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day) - JAKARTA_OFFSET_MS);
}

export type AnalyticsRange = {
  days: number;
  /** Awal rentang (inklusif). */
  from: Date;
  /** Akhir rentang (eksklusif) — besok 00:00 WIB, jadi hari ini ikut terhitung. */
  to: Date;
  prevFrom: Date;
  prevTo: Date;
};

/** Rentang `days` hari yang berakhir hari ini (WIB), plus rentang pembanding sebelumnya yang sama panjang. */
export function resolveRange(days: number, now: Date = new Date()): AnalyticsRange {
  const to = new Date(jakartaStartOfDay(now).getTime() + DAY_MS);
  const from = new Date(to.getTime() - days * DAY_MS);
  const prevFrom = new Date(from.getTime() - days * DAY_MS);
  return { days, from, to, prevFrom, prevTo: from };
}

/** Persentase perubahan. null kalau pembanding 0 — "tak terhingga" bukan angka yang jujur. */
export function pctChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

export type DailyPoint = { day: string; views: number; visitors: number };

/** Mengisi hari tanpa kunjungan dengan 0 supaya grafik tidak melompati tanggal. */
export function fillDailySeries(rows: DailyPoint[], from: Date, days: number): DailyPoint[] {
  const byDay = new Map(rows.map((r) => [r.day, r]));
  return Array.from({ length: days }, (_, i) => {
    const day = jakartaDay(new Date(from.getTime() + i * DAY_MS));
    return byDay.get(day) ?? { day, views: 0, visitors: 0 };
  });
}
