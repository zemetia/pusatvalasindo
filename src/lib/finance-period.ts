/**
 * Periode laporan finance — preset kalender (hari ini, 7 hari, bulan ini, kuartal,
 * tahun) plus rentang custom, plus periode pembanding yang panjangnya persis sama.
 *
 * Seluruh tanggal dipegang sebagai kunci `"YYYY-MM-DD"` dan dihitung di UTC,
 * mengikuti konvensi tanggal modul stockist/bank (lihat
 * `stockist-head-confirmation.service.ts` dan `@db.Date` di schema) supaya
 * "hari ini" di laporan ini menunjuk hari yang sama dengan halaman cross-check.
 *
 * Aman dipakai dari server maupun client (murni fungsi, tanpa dependensi).
 */

export const PERIOD_PRESETS = [
  { value: "hari-ini", label: "Hari ini" },
  { value: "kemarin", label: "Kemarin" },
  { value: "7-hari", label: "7 hari" },
  { value: "30-hari", label: "30 hari" },
  { value: "bulan-ini", label: "Bulan ini" },
  { value: "bulan-lalu", label: "Bulan lalu" },
  { value: "kuartal-ini", label: "Kuartal ini" },
  { value: "tahun-ini", label: "Tahun ini" },
  { value: "custom", label: "Custom" },
] as const;

export type PeriodPreset = (typeof PERIOD_PRESETS)[number]["value"];

export type DateKey = string;

export type PeriodRange = {
  preset: PeriodPreset;
  from: DateKey;
  to: DateKey;
  /** Jumlah hari kalender dalam rentang, inklusif kedua ujung. */
  days: number;
  /** Rentang pembanding: `days` hari tepat sebelum `from`. */
  prevFrom: DateKey;
  prevTo: DateKey;
  /** Label pembanding untuk teks inline di samping pil delta. */
  comparisonLabel: string;
};

const DAY_MS = 86_400_000;
const KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/* ── Primitif tanggal UTC ─────────────────────────────────────────────────── */

export function toKey(date: Date): DateKey {
  return date.toISOString().slice(0, 10);
}

/** `null` untuk input yang bukan `YYYY-MM-DD` valid — parameter URL tidak dipercaya. */
export function parseKey(key: string | null | undefined): Date | null {
  if (!key || !KEY_PATTERN.test(key)) return null;
  const date = new Date(`${key}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  // Menolak tanggal yang "menggulung" (mis. 2026-02-31 → 3 Maret).
  return toKey(date) === key ? date : null;
}

export function addDays(key: DateKey, amount: number): DateKey {
  return toKey(new Date(new Date(`${key}T00:00:00.000Z`).getTime() + amount * DAY_MS));
}

export function daysBetween(from: DateKey, to: DateKey): number {
  const diff =
    new Date(`${to}T00:00:00.000Z`).getTime() - new Date(`${from}T00:00:00.000Z`).getTime();
  return Math.round(diff / DAY_MS) + 1;
}

/** Semua tanggal dari `from` sampai `to`, inklusif. */
export function enumerateDates(from: DateKey, to: DateKey): DateKey[] {
  const out: DateKey[] = [];
  for (let key = from; key <= to; key = addDays(key, 1)) out.push(key);
  return out;
}

export function todayKey(): DateKey {
  return toKey(new Date());
}

const JAKARTA_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * "Hari ini" menurut jam operasional (WIB, UTC+7) — bukan menurut jam server.
 *
 * Dipakai di permukaan yang menjawab "sampai hari ini sudah sejauh mana"
 * (kalender kehadiran, masa kerja). `todayKey()` yang berbasis UTC tetap ada
 * untuk modul yang kunci hariannya memang disepakati di UTC (stockist/bank);
 * memakai yang salah menggeser sehari di rentang 00:00–07:00 WIB.
 */
export function todayKeyJakarta(): DateKey {
  return JAKARTA_DATE.format(new Date());
}

export function startOfMonth(key: DateKey): DateKey {
  return `${key.slice(0, 7)}-01`;
}

export function endOfMonth(key: DateKey): DateKey {
  const [year, month] = key.split("-").map(Number);
  // Hari ke-0 bulan berikutnya = hari terakhir bulan ini.
  return toKey(new Date(Date.UTC(year, month, 0)));
}

/** `2026-07-28` → `2026-07`. */
export function monthKey(key: DateKey): string {
  return key.slice(0, 7);
}

export function addMonths(month: string, amount: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + amount, 1));
  return toKey(date).slice(0, 7);
}

/* ── Resolusi periode ─────────────────────────────────────────────────────── */

function rangeForPreset(preset: PeriodPreset, today: DateKey): { from: DateKey; to: DateKey } {
  switch (preset) {
    case "hari-ini":
      return { from: today, to: today };
    case "kemarin": {
      const yesterday = addDays(today, -1);
      return { from: yesterday, to: yesterday };
    }
    case "7-hari":
      return { from: addDays(today, -6), to: today };
    case "30-hari":
      return { from: addDays(today, -29), to: today };
    case "bulan-ini":
      return { from: startOfMonth(today), to: today };
    case "bulan-lalu": {
      const lastMonth = addDays(startOfMonth(today), -1);
      return { from: startOfMonth(lastMonth), to: lastMonth };
    }
    case "kuartal-ini": {
      const month = Number(today.slice(5, 7));
      const quarterStartMonth = Math.floor((month - 1) / 3) * 3 + 1;
      return {
        from: `${today.slice(0, 4)}-${String(quarterStartMonth).padStart(2, "0")}-01`,
        to: today,
      };
    }
    case "tahun-ini":
      return { from: `${today.slice(0, 4)}-01-01`, to: today };
    case "custom":
      // Ditangani pemanggil; fallback aman kalau parameternya tidak valid.
      return { from: addDays(today, -29), to: today };
  }
}

function isPreset(value: string | null | undefined): value is PeriodPreset {
  return PERIOD_PRESETS.some((p) => p.value === value);
}

/**
 * Batas panjang periode. Rentang custom datang dari URL, jadi tanpa batas ini
 * `?dari=2000-01-01&sampai=2030-12-31` akan memaksa server membangun deret
 * puluhan ribu hari (dikali jumlah PT, dikali dua karena periode pembanding).
 * Setahun sudah menampung preset terpanjang (`tahun-ini`).
 */
export const MAX_PERIOD_DAYS = 366;

/**
 * Menerjemahkan parameter URL menjadi rentang yang bisa dipakai query.
 *
 * Input tidak dipercaya: preset asing jatuh ke `30-hari`, tanggal custom yang
 * tidak valid jatuh ke rentang preset, `from > to` otomatis ditukar, dan rentang
 * yang lebih panjang dari `MAX_PERIOD_DAYS` dipotong dari ujung awal.
 */
export function resolvePeriod(params: {
  preset?: string | null;
  from?: string | null;
  to?: string | null;
  today?: DateKey;
}): PeriodRange {
  const today = params.today ?? todayKey();
  const preset: PeriodPreset = isPreset(params.preset) ? params.preset : "30-hari";

  let from: DateKey;
  let to: DateKey;

  const customFrom = parseKey(params.from);
  const customTo = parseKey(params.to);

  if (preset === "custom" && customFrom && customTo) {
    from = toKey(customFrom);
    to = toKey(customTo);
    if (from > to) [from, to] = [to, from];
  } else {
    ({ from, to } = rangeForPreset(preset, today));
  }

  // Dipotong dari ujung awal, bukan ujung akhir: yang paling relevan di laporan
  // keuangan adalah posisi terkini, jadi `to` yang dipertahankan.
  if (daysBetween(from, to) > MAX_PERIOD_DAYS) {
    from = addDays(to, -(MAX_PERIOD_DAYS - 1));
  }

  const days = daysBetween(from, to);
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(prevTo, -(days - 1));

  return {
    preset,
    from,
    to,
    days,
    prevFrom,
    prevTo,
    comparisonLabel: comparisonLabelFor(preset, days),
  };
}

function comparisonLabelFor(preset: PeriodPreset, days: number): string {
  switch (preset) {
    case "hari-ini":
      return "vs kemarin";
    case "kemarin":
      return "vs hari sebelumnya";
    case "bulan-ini":
    case "bulan-lalu":
      return "vs bulan sebelumnya";
    case "kuartal-ini":
      return "vs kuartal sebelumnya";
    case "tahun-ini":
      return "vs tahun sebelumnya";
    default:
      return `vs ${days} hari sebelumnya`;
  }
}

/* ── Grid kalender ────────────────────────────────────────────────────────── */

/**
 * Matriks 7 kolom untuk satu bulan, pekan dimulai Senin (konvensi Indonesia).
 * Sel di luar bulan bernilai `null` supaya pemanggil bisa merendernya kosong.
 */
export function monthGrid(month: string): (DateKey | null)[][] {
  const first = `${month}-01`;
  const last = endOfMonth(first);
  // getUTCDay(): 0 = Minggu → digeser supaya Senin = 0.
  const leading = (new Date(`${first}T00:00:00.000Z`).getUTCDay() + 6) % 7;

  const cells: (DateKey | null)[] = Array.from({ length: leading }, () => null);
  for (const key of enumerateDates(first, last)) cells.push(key);
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (DateKey | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export const WEEKDAY_LABELS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"] as const;
