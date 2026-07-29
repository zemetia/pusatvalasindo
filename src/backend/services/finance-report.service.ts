import prisma from "@/lib/prisma";
import {
  financeReportRepository,
  type ConfirmationKind,
  type ConfirmationRow,
  type QualityRow,
  type StockQtyRow,
  type SystemSumRow,
} from "@/backend/repositories/finance-report.repository";
import { enumerateDates, type PeriodRange } from "@/lib/finance-period";

/**
 * Laporan Finance: posisi keuangan konsolidasi seluruh PT per satuan waktu.
 *
 * Dua keputusan model yang menentukan seluruh angka di halaman ini:
 *
 * 1. **Posisi, bukan arus.** Stock/kas/bank adalah saldo, jadi angka periode
 *    dibaca sebagai posisi awal → posisi akhir. "Perubahan bersih" adalah
 *    selisih keduanya — indikator hasil usaha, *bukan* laba bersih (belum
 *    dikurangi biaya operasional dan belum memisahkan setoran/penarikan modal).
 *    Halaman wajib menyebut batasan ini, bukan menyamarkannya sebagai profit.
 *
 * 2. **Saldo dibawa maju (carry-forward).** Konfirmasi kepala cabang tidak
 *    selalu terisi setiap hari. Hari tanpa konfirmasi bukan berarti saldo nol —
 *    saldo terakhir masih berlaku sampai ada konfirmasi berikutnya. Karena itu
 *    setiap komponen dibawa maju sendiri-sendiri, dengan seed dari konfirmasi
 *    terakhir sebelum periode pembanding.
 *
 * Konsekuensi dari (2): total harian **dihitung ulang** dari komponen yang
 * dibawa maju, tidak diambil dari `CompanyHeadConfirmationTotal`. Kolom itu
 * hanya menjumlahkan konfirmasi bertanggal sama, sehingga hari yang cuma
 * dikonfirmasi sebagian akan tampak anjlok padahal stock & kas-nya utuh.
 */

const TOLERANCE = 0.5; // selisih di bawah setengah rupiah = pembulatan, bukan beda

export type FinancePosition = {
  /** Tanggal konfirmasi terakhir yang membentuk posisi ini. */
  date: string | null;
  stock: number | null;
  kas: number | null;
  bank: number | null;
  total: number | null;
};

export type FinanceSeriesPoint = {
  date: string;
  stock: number | null;
  kas: number | null;
  bank: number | null;
  total: number | null;
  /** True bila tanggal ini punya konfirmasi sendiri (bukan hasil carry-forward). */
  confirmed: boolean;
};

export type CrossCheckSummary = {
  /** Tanggal terakhir yang punya angka sistem *dan* angka konfirmasi. */
  date: string | null;
  system: number | null;
  confirmed: number | null;
  diff: number | null;
  comparedDays: number;
  mismatchDays: number;
  /** Selisih absolut terbesar sepanjang periode. */
  worstDiff: number | null;
  worstDate: string | null;
};

export type VerificationCounts = {
  benar: number;
  beda: number;
  belumReview: number;
  total: number;
};

export type CorrectionCounts = {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
};

export type StockItemPosition = {
  id: string;
  name: string;
  code: string | null;
  type: "CURRENCY" | "LOGAM_MULIA";
  qty: number | null;
  date: string | null;
};

export type CompanyFinanceReport = {
  id: string;
  name: string;
  code: string;
  opening: FinancePosition;
  closing: FinancePosition;
  netChange: number | null;
  prevNetChange: number | null;
  avgTotal: number | null;
  peak: { date: string; value: number } | null;
  trough: { date: string; value: number } | null;
  confirmedDays: number;
  series: FinanceSeriesPoint[];
  crossCheck: { kas: CrossCheckSummary; bank: CrossCheckSummary };
  verification: { stock: VerificationCounts; kas: VerificationCounts; bank: VerificationCounts };
  corrections: CorrectionCounts;
  stockItems: StockItemPosition[];
};

export type GroupFinanceReport = {
  opening: FinancePosition;
  closing: FinancePosition;
  prevOpening: FinancePosition;
  prevClosing: FinancePosition;
  netChange: number | null;
  prevNetChange: number | null;
  avgTotal: number | null;
  peak: { date: string; value: number } | null;
  trough: { date: string; value: number } | null;
  /** Jumlah hari dalam periode yang punya minimal satu konfirmasi. */
  confirmedDays: number;
  series: FinanceSeriesPoint[];
  /** Deret penuh termasuk periode pembanding — dipakai kalender & tren. */
  fullSeries: FinanceSeriesPoint[];
  verification: VerificationCounts;
  corrections: CorrectionCounts;
};

export type FinanceReport = {
  range: PeriodRange;
  companies: CompanyFinanceReport[];
  group: GroupFinanceReport;
};

/* ── Helper agregasi ──────────────────────────────────────────────────────── */

type Components = { stock: number | null; kas: number | null; bank: number | null };

function totalOf(components: Components): number | null {
  const parts = [components.stock, components.kas, components.bank].filter(
    (value): value is number => value != null,
  );
  if (parts.length === 0) return null;
  return parts.reduce((sum, value) => sum + value, 0);
}

function positionAt(point: FinanceSeriesPoint | undefined): FinancePosition {
  if (!point) return { date: null, stock: null, kas: null, bank: null, total: null };
  return {
    date: point.date,
    stock: point.stock,
    kas: point.kas,
    bank: point.bank,
    total: point.total,
  };
}

/** `Map<companyId, Map<date, Partial<Components>>>` dari baris konfirmasi mentah. */
function indexConfirmations(rows: ConfirmationRow[]) {
  const byCompany = new Map<string, Map<string, Partial<Components>>>();
  for (const row of rows) {
    let byDate = byCompany.get(row.companyId);
    if (!byDate) {
      byDate = new Map();
      byCompany.set(row.companyId, byDate);
    }
    const bucket = byDate.get(row.date) ?? {};
    bucket[keyOf(row.kind)] = row.amount;
    byDate.set(row.date, bucket);
  }
  return byCompany;
}

function keyOf(kind: ConfirmationKind): keyof Components {
  return kind === "STOCK" ? "stock" : kind === "KAS" ? "kas" : "bank";
}

/**
 * Deret harian satu PT sepanjang `dates`, dengan tiap komponen dibawa maju dari
 * konfirmasi terakhirnya. `seed` adalah posisi terakhir sebelum tanggal pertama.
 */
function buildSeries(
  dates: string[],
  byDate: Map<string, Partial<Components>> | undefined,
  seed: Components,
): FinanceSeriesPoint[] {
  let carry: Components = { ...seed };

  return dates.map((date) => {
    const confirmation = byDate?.get(date);
    if (confirmation) {
      carry = {
        stock: confirmation.stock ?? carry.stock,
        kas: confirmation.kas ?? carry.kas,
        bank: confirmation.bank ?? carry.bank,
      };
    }
    return {
      date,
      stock: carry.stock,
      kas: carry.kas,
      bank: carry.bank,
      total: totalOf(carry),
      confirmed: Boolean(confirmation),
    };
  });
}

/** Menjumlahkan deret beberapa PT menjadi satu deret konsolidasi per tanggal. */
function sumSeries(dates: string[], seriesList: FinanceSeriesPoint[][]): FinanceSeriesPoint[] {
  return dates.map((date, index) => {
    const points = seriesList.map((series) => series[index]);
    const stock = sumNullable(points.map((p) => p.stock));
    const kas = sumNullable(points.map((p) => p.kas));
    const bank = sumNullable(points.map((p) => p.bank));
    return {
      date,
      stock,
      kas,
      bank,
      total: totalOf({ stock, kas, bank }),
      confirmed: points.some((p) => p.confirmed),
    };
  });
}

/** `null` hanya bila semua nilainya kosong — satu PT yang sudah terisi tetap dihitung. */
function sumNullable(values: (number | null)[]): number | null {
  const known = values.filter((value): value is number => value != null);
  return known.length === 0 ? null : known.reduce((sum, value) => sum + value, 0);
}

function summarize(series: FinanceSeriesPoint[]) {
  let sum = 0;
  let count = 0;
  let confirmedDays = 0;
  let peak: { date: string; value: number } | null = null;
  let trough: { date: string; value: number } | null = null;

  for (const point of series) {
    if (point.confirmed) confirmedDays += 1;
    const value = point.total;
    if (value == null) continue;
    sum += value;
    count += 1;
    if (!peak || value > peak.value) peak = { date: point.date, value };
    if (!trough || value < trough.value) trough = { date: point.date, value };
  }

  return { avgTotal: count === 0 ? null : sum / count, peak, trough, confirmedDays };
}

function emptyCrossCheck(): CrossCheckSummary {
  return {
    date: null,
    system: null,
    confirmed: null,
    diff: null,
    comparedDays: 0,
    mismatchDays: 0,
    worstDiff: null,
    worstDate: null,
  };
}

/**
 * Membandingkan angka sistem vs angka konfirmasi kepala cabang hari per hari.
 * Hanya tanggal yang punya *kedua* angka yang dibandingkan — hari yang belum
 * dikonfirmasi bukan "selisih", melainkan belum ada datanya.
 */
function buildCrossCheck(
  dates: string[],
  systemByDate: Map<string, number>,
  confirmedByDate: Map<string, number>,
): CrossCheckSummary {
  const result = emptyCrossCheck();

  for (const date of dates) {
    const system = systemByDate.get(date);
    const confirmed = confirmedByDate.get(date);
    if (system == null || confirmed == null) continue;

    const diff = confirmed - system;
    result.comparedDays += 1;
    if (Math.abs(diff) > TOLERANCE) result.mismatchDays += 1;
    if (result.worstDiff == null || Math.abs(diff) > Math.abs(result.worstDiff)) {
      result.worstDiff = diff;
      result.worstDate = date;
    }
    // Tanggal terakhir menang: ringkasan menampilkan kondisi terkini.
    result.date = date;
    result.system = system;
    result.confirmed = confirmed;
    result.diff = diff;
  }

  return result;
}

const EMPTY_VERIFICATION: VerificationCounts = { benar: 0, beda: 0, belumReview: 0, total: 0 };

function addVerification(target: VerificationCounts, status: string, count: number) {
  if (status === "BENAR") target.benar += count;
  else if (status === "BEDA") target.beda += count;
  else target.belumReview += count;
  target.total += count;
}

function mergeVerification(parts: VerificationCounts[]): VerificationCounts {
  return parts.reduce<VerificationCounts>(
    (acc, part) => ({
      benar: acc.benar + part.benar,
      beda: acc.beda + part.beda,
      belumReview: acc.belumReview + part.belumReview,
      total: acc.total + part.total,
    }),
    { ...EMPTY_VERIFICATION },
  );
}

function indexQuality(rows: QualityRow[], companyIds: string[]) {
  const map = new Map<
    string,
    {
      verification: {
        stock: VerificationCounts;
        kas: VerificationCounts;
        bank: VerificationCounts;
      };
      corrections: CorrectionCounts;
    }
  >();

  for (const id of companyIds) {
    map.set(id, {
      verification: {
        stock: { ...EMPTY_VERIFICATION },
        kas: { ...EMPTY_VERIFICATION },
        bank: { ...EMPTY_VERIFICATION },
      },
      corrections: { pending: 0, approved: 0, rejected: 0, total: 0 },
    });
  }

  for (const row of rows) {
    const bucket = map.get(row.companyId);
    if (!bucket) continue;

    if (row.kind === "KOREKSI") {
      if (row.status === "PENDING") bucket.corrections.pending += row.count;
      else if (row.status === "APPROVED") bucket.corrections.approved += row.count;
      else if (row.status === "REJECTED") bucket.corrections.rejected += row.count;
      bucket.corrections.total += row.count;
      continue;
    }

    const target =
      row.kind === "STOCK"
        ? bucket.verification.stock
        : row.kind === "KAS"
          ? bucket.verification.kas
          : bucket.verification.bank;
    addVerification(target, row.status, row.count);
  }

  return map;
}

function indexSystemSums(rows: SystemSumRow[]) {
  const map = new Map<string, { kas: Map<string, number>; bank: Map<string, number> }>();
  for (const row of rows) {
    let bucket = map.get(row.companyId);
    if (!bucket) {
      bucket = { kas: new Map(), bank: new Map() };
      map.set(row.companyId, bucket);
    }
    (row.kind === "KAS" ? bucket.kas : bucket.bank).set(row.date, row.amount);
  }
  return map;
}

function indexStockQuantities(rows: StockQtyRow[]) {
  const map = new Map<string, Map<string, { qty: number; date: string }>>();
  for (const row of rows) {
    let bucket = map.get(row.companyId);
    if (!bucket) {
      bucket = new Map();
      map.set(row.companyId, bucket);
    }
    bucket.set(row.companyStockItemId, { qty: row.qty, date: row.date });
  }
  return map;
}

/* ── Service ──────────────────────────────────────────────────────────────── */

export const financeReportService = {
  /**
   * Menyusun laporan lengkap untuk `companyIds` pada `range`.
   *
   * Tujuh query ditembak sekaligus (tanpa waterfall): konfirmasi & posisi awal
   * mencakup periode pembanding sekaligus, sehingga seluruh delta "vs periode
   * sebelumnya" bisa dihitung tanpa round-trip tambahan.
   */
  getReport: async (companyIds: string[], range: PeriodRange): Promise<FinanceReport> => {
    const periodDates = enumerateDates(range.from, range.to);
    // Deret dibangun sejak awal periode pembanding supaya posisi awal periode
    // terpilih tidak perlu dihitung ulang lewat query terpisah.
    const fullDates = enumerateDates(range.prevFrom, range.to);

    const [companies, confirmations, openings, systemSums, quality, stockQuantities, stockItems] =
      await Promise.all([
        prisma.company.findMany({
          where: { id: { in: companyIds } },
          orderBy: { name: "asc" },
          select: { id: true, name: true, code: true },
        }),
        financeReportRepository.confirmationsInRange(companyIds, range.prevFrom, range.to),
        financeReportRepository.openingPositions(companyIds, range.prevFrom),
        financeReportRepository.systemSumsInRange(companyIds, range.from, range.to),
        financeReportRepository.qualityCounts(companyIds, range.from, range.to),
        financeReportRepository.closingStockQuantities(companyIds, range.from, range.to),
        prisma.companyStockItem.findMany({
          where: { companyId: { in: companyIds }, isActive: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          select: { id: true, companyId: true, name: true, code: true, type: true },
        }),
      ]);

    const confirmationIndex = indexConfirmations(confirmations);
    const openingIndex = indexConfirmations(openings);
    const systemIndex = indexSystemSums(systemSums);
    const qualityIndex = indexQuality(quality, companyIds);
    const stockQtyIndex = indexStockQuantities(stockQuantities);

    const periodOffset = fullDates.indexOf(range.from);
    const prevClosingIndex = periodOffset - 1;

    const fullSeriesByCompany: FinanceSeriesPoint[][] = [];
    // Posisi tepat sebelum periode pembanding, per PT — dijumlahkan jadi posisi
    // awal grup supaya "perubahan bersih periode lalu" dihitung dengan basis
    // yang sama persis seperti versi per-PT-nya.
    const companyPrevOpenings: FinancePosition[] = [];

    const companyReports: CompanyFinanceReport[] = companies.map((company) => {
      // Posisi awal periode pembanding: satu baris terakhir per komponen, yang
      // tanggalnya bisa berbeda-beda antar komponen.
      const seedRows = openingIndex.get(company.id);
      const seed: Components = { stock: null, kas: null, bank: null };
      let seedDate: string | null = null;
      for (const [date, components] of seedRows ?? []) {
        if (components.stock != null) seed.stock = components.stock;
        if (components.kas != null) seed.kas = components.kas;
        if (components.bank != null) seed.bank = components.bank;
        if (!seedDate || date > seedDate) seedDate = date;
      }

      const fullSeries = buildSeries(fullDates, confirmationIndex.get(company.id), seed);
      fullSeriesByCompany.push(fullSeries);

      const series = fullSeries.slice(periodOffset);
      const opening =
        prevClosingIndex >= 0
          ? positionAt(fullSeries[prevClosingIndex])
          : { date: seedDate, ...seed, total: totalOf(seed) };
      const closing = positionAt(fullSeries[fullSeries.length - 1]);
      const prevOpening: FinancePosition = { date: seedDate, ...seed, total: totalOf(seed) };
      companyPrevOpenings.push(prevOpening);

      const stats = summarize(series);
      const systemBuckets = systemIndex.get(company.id);
      const confirmedKas = new Map<string, number>();
      const confirmedBank = new Map<string, number>();
      for (const [date, components] of confirmationIndex.get(company.id) ?? []) {
        if (components.kas != null) confirmedKas.set(date, components.kas);
        if (components.bank != null) confirmedBank.set(date, components.bank);
      }

      const companyQuality = qualityIndex.get(company.id);
      const qtyBucket = stockQtyIndex.get(company.id);

      return {
        id: company.id,
        name: company.name,
        code: company.code,
        opening,
        closing,
        netChange: delta(opening.total, closing.total),
        prevNetChange: delta(prevOpening.total, opening.total),
        avgTotal: stats.avgTotal,
        peak: stats.peak,
        trough: stats.trough,
        confirmedDays: stats.confirmedDays,
        series,
        crossCheck: {
          kas: buildCrossCheck(periodDates, systemBuckets?.kas ?? new Map(), confirmedKas),
          bank: buildCrossCheck(periodDates, systemBuckets?.bank ?? new Map(), confirmedBank),
        },
        verification: companyQuality?.verification ?? {
          stock: { ...EMPTY_VERIFICATION },
          kas: { ...EMPTY_VERIFICATION },
          bank: { ...EMPTY_VERIFICATION },
        },
        corrections: companyQuality?.corrections ?? {
          pending: 0,
          approved: 0,
          rejected: 0,
          total: 0,
        },
        stockItems: stockItems
          .filter((item) => item.companyId === company.id)
          .map((item) => {
            const entry = qtyBucket?.get(item.id);
            return {
              id: item.id,
              name: item.name,
              code: item.code,
              type: item.type,
              qty: entry?.qty ?? null,
              date: entry?.date ?? null,
            };
          }),
      };
    });

    const groupFullSeries = sumSeries(fullDates, fullSeriesByCompany);
    const groupSeries = groupFullSeries.slice(periodOffset);
    const groupStats = summarize(groupSeries);

    const groupOpening =
      prevClosingIndex >= 0
        ? positionAt(groupFullSeries[prevClosingIndex])
        : positionAt(groupFullSeries[0]);
    const groupClosing = positionAt(groupFullSeries[groupFullSeries.length - 1]);
    const groupPrevOpening = sumPositions(companyPrevOpenings);

    return {
      range,
      companies: companyReports,
      group: {
        opening: groupOpening,
        closing: groupClosing,
        prevOpening: groupPrevOpening,
        prevClosing: groupOpening,
        netChange: delta(groupOpening.total, groupClosing.total),
        prevNetChange: delta(groupPrevOpening.total, groupOpening.total),
        avgTotal: groupStats.avgTotal,
        peak: groupStats.peak,
        trough: groupStats.trough,
        confirmedDays: groupStats.confirmedDays,
        series: groupSeries,
        fullSeries: groupFullSeries,
        verification: mergeVerification(
          companyReports.flatMap((company) => [
            company.verification.stock,
            company.verification.kas,
            company.verification.bank,
          ]),
        ),
        corrections: companyReports.reduce<CorrectionCounts>(
          (acc, company) => ({
            pending: acc.pending + company.corrections.pending,
            approved: acc.approved + company.corrections.approved,
            rejected: acc.rejected + company.corrections.rejected,
            total: acc.total + company.corrections.total,
          }),
          { pending: 0, approved: 0, rejected: 0, total: 0 },
        ),
      },
    };
  },
};

function delta(from: number | null, to: number | null): number | null {
  if (from == null || to == null) return null;
  return to - from;
}

/** Menjumlahkan beberapa posisi PT jadi satu posisi grup; tanggal diambil yang terbaru. */
function sumPositions(positions: FinancePosition[]): FinancePosition {
  const stock = sumNullable(positions.map((p) => p.stock));
  const kas = sumNullable(positions.map((p) => p.kas));
  const bank = sumNullable(positions.map((p) => p.bank));
  const dates = positions
    .map((p) => p.date)
    .filter((date): date is string => date != null)
    .sort();
  return {
    date: dates[dates.length - 1] ?? null,
    stock,
    kas,
    bank,
    total: totalOf({ stock, kas, bank }),
  };
}
