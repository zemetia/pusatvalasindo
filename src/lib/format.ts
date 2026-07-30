/**
 * Pemformatan angka & tanggal untuk permukaan laporan.
 *
 * Aturannya dari `docs/blueprint/DATA_PRESENTATION.md` §7: seluruh angka bisnis
 * memakai locale `id-ID`, rupiah tanpa desimal, nol tetap dirender `0`, dan nilai
 * yang tidak ada dirender em dash — bukan `-`, bukan kosong, bukan `NaN`.
 *
 * Dipformat di server (tempat angkanya diambil) supaya client tidak ikut
 * membawa cabang pemformatan.
 */

const IDR = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
const QTY = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 });
const ONE_DECIMAL = new Intl.NumberFormat("id-ID", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const RATE = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 4 });

/** Nilai kosong / non-finite selalu jadi em dash — lihat DATA_PRESENTATION §7. */
export const EM_DASH = "—";

function missing(value: number | null | undefined): value is null | undefined {
  return value == null || !Number.isFinite(value);
}

/**
 * `1.284.500.000` — simbol `Rp` dirender terpisah (kecil & muted) oleh MetricValue.
 *
 * Nilai negatif memakai tanda minus tipografis (−, U+2212), bukan hyphen ASCII,
 * supaya sejajar dengan `formatIdrSigned` dan `formatCompactIdr`; kalau dibiarkan
 * berbeda, satu tabel bisa memuat dua bentuk minus sekaligus.
 */
export function formatIdr(value: number | null | undefined): string {
  if (missing(value)) return EM_DASH;
  const rounded = Math.round(value);
  return rounded < 0 ? `−${IDR.format(Math.abs(rounded))}` : IDR.format(rounded);
}

/** Sama seperti `formatIdr` tapi selalu bertanda — untuk selisih & perubahan. */
export function formatIdrSigned(value: number | null | undefined): string {
  if (missing(value)) return EM_DASH;
  const rounded = Math.round(value);
  if (rounded === 0) return "0";
  return `${rounded > 0 ? "+" : "−"}${IDR.format(Math.abs(rounded))}`;
}

/**
 * Bentuk ringkas untuk hero & baris sorotan: `18,4 M` / `412,7 jt` / `95,2 rb`.
 * Dilarang dipakai di tabel dan export (DATA_PRESENTATION §7).
 */
export function formatCompactIdr(value: number | null | undefined): string {
  if (missing(value)) return EM_DASH;
  const sign = value < 0 ? "−" : "";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${sign}${ONE_DECIMAL.format(abs / 1_000_000_000)} M`;
  if (abs >= 1_000_000) return `${sign}${ONE_DECIMAL.format(abs / 1_000_000)} jt`;
  if (abs >= 1_000) return `${sign}${ONE_DECIMAL.format(abs / 1_000)} rb`;
  return `${sign}${IDR.format(Math.round(abs))}`;
}

/** Kuantitas stock — beda dari rupiah karena logam mulia punya pecahan gram. */
export function formatQty(value: number | null | undefined): string {
  if (missing(value)) return EM_DASH;
  return QTY.format(value);
}

/**
 * Kurs valas — beda dari rupiah karena mata uang kecil (JPY, KRW, VND) baru
 * bermakna di belakang koma: `16.250` untuk USD, `108,4567` untuk JPY.
 */
export function formatRate(value: number | null | undefined): string {
  if (missing(value)) return EM_DASH;
  return RATE.format(value);
}

/** `4,2%` — satu desimal, koma, persen menempel (DATA_PRESENTATION §7). */
export function formatPercent(value: number | null | undefined): string {
  if (missing(value)) return EM_DASH;
  return `${ONE_DECIMAL.format(value)}%`;
}

/** Bilangan bulat tanpa satuan tambahan. */
export function formatCount(value: number | null | undefined): string {
  if (missing(value)) return EM_DASH;
  return IDR.format(value);
}

/**
 * Persentase perubahan `base → current`.
 *
 * `null` (bukan 0, bukan Infinity) saat pembandingnya tidak ada atau nol — pil
 * delta merender em dash untuk kasus ini, sesuai DATA_PRESENTATION §6.
 */
export function pctChange(
  base: number | null | undefined,
  current: number | null | undefined,
): number | null {
  if (missing(base) || missing(current) || base === 0) return null;
  return ((current - base) / Math.abs(base)) * 100;
}

/** Porsi `part` terhadap `total` dalam persen; `null` bila total nol/absen. */
export function share(part: number | null | undefined, total: number | null | undefined) {
  if (missing(part) || missing(total) || total === 0) return null;
  return (part / total) * 100;
}

/* ── Tanggal ──────────────────────────────────────────────────────────────── */
// Kunci tanggal selalu "YYYY-MM-DD" dan diformat di zona UTC, sama seperti cara
// tanggal disimpan (`@db.Date`) dan dibandingkan di modul stockist/bank.

const DATE_FULL = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const DATE_SHORT = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const MONTH_LONG = new Intl.DateTimeFormat("id-ID", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function asUtcDate(key: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const date = new Date(`${key}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** `2026-07-28` → `28 Jul 2026`. */
export function formatDate(key: string | null | undefined): string {
  const date = key ? asUtcDate(key) : null;
  return date ? DATE_FULL.format(date) : EM_DASH;
}

/** `2026-07-28` → `28 Jul`. */
export function formatDateShort(key: string | null | undefined): string {
  const date = key ? asUtcDate(key) : null;
  return date ? DATE_SHORT.format(date) : EM_DASH;
}

/** `2026-07` atau `2026-07-28` → `Juli 2026`. */
export function formatMonth(key: string): string {
  const date = asUtcDate(key.length === 7 ? `${key}-01` : key);
  return date ? MONTH_LONG.format(date) : EM_DASH;
}
