/**
 * Bentuk data & agregasi untuk halaman Analisis Kinerja.
 *
 * Agregatnya ditaruh di sini, bukan di service, karena halaman menghitungnya
 * ulang setiap kali filter berubah — memfilter PT lalu tetap menampilkan
 * rata-rata seluruh perusahaan membuat angkanya menyesatkan. Server hanya
 * mengirim baris per karyawan; totals, per-PT, dan per-jabatan diturunkan dari
 * baris yang lolos filter, di server maupun di client, lewat fungsi yang sama.
 */

export type PeriodRef = { month: number; year: number };

export type KpiHighlight = { name: string; achievement: number };

/** Karyawan tanpa cabang (mis. jabatan global) tetap harus bisa difilter. */
export const NO_COMPANY = "__none__";
export const NO_BRANCH = "__none__";

export type EmployeePerformance = {
  employeeId: string;
  name: string;
  roleName: string;
  /** `null` = tidak terikat cabang mana pun (jabatan global). */
  branchId: string | null;
  branchName: string;
  companyId: string | null;
  companyCode: string;
  companyName: string;
  /** Rasio pencapaian 0..1,2. `null` = periode ini belum dihitung. */
  score: number | null;
  grade: string | null;
  prevScore: number | null;
  /** Perubahan relatif terhadap bulan lalu, dalam persen. */
  deltaPct: number | null;
  /** KPI berbobot pada periode ini, urut dari pencapaian terendah. */
  kpis: KpiHighlight[];
  /** Skor 6 bulan terakhir, urut lama → baru. `null` untuk bulan tanpa hasil. */
  history: (number | null)[];
};

export type GroupPerformance = {
  key: string;
  label: string;
  /** Keterangan kelompok, mis. nama PT pada baris jabatan × PT. */
  subLabel?: string;
  avgScore: number | null;
  prevAvgScore: number | null;
  deltaPct: number | null;
  scored: number;
  employees: number;
  /** KPI dengan pencapaian rata-rata terendah dalam kelompok ini. */
  weakestKpi: KpiHighlight | null;
};

export type PerformanceTotals = {
  employees: number;
  scored: number;
  unscored: number;
  avgScore: number | null;
  prevAvgScore: number | null;
  avgDeltaPct: number | null;
  gradeCounts: { A: number; B: number; C: number; D: number };
  /** Rata-rata skor kelompok per bulan, sejajar dengan `historyLabels`. */
  history: (number | null)[];
};

export type PerformanceAggregate = {
  totals: PerformanceTotals;
  byCompany: GroupPerformance[];
  byRole: GroupPerformance[];
  /** Silang jabatan × PT — dipakai saat filter PT/jabatan dipersempit. */
  byRoleCompany: GroupPerformance[];
};

export type PerformanceOverview = {
  period: PeriodRef & { label: string };
  historyLabels: string[];
  rows: EmployeePerformance[];
};

export function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Perubahan relatif dalam persen. `null` bila tidak ada pembanding yang sah —
 * pembagian dengan nol akan memberi `Infinity`, dan DeltaPill sudah dirancang
 * untuk menampilkan em dash saat nilainya bukan angka berhingga.
 */
export function relativeDelta(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

type GroupAgg = {
  label: string;
  subLabel?: string;
  employees: number;
  scores: number[];
  prevScores: number[];
  kpiTotals: Map<string, { sum: number; count: number }>;
};

function collect(
  rows: EmployeePerformance[],
  keyOf: (r: EmployeePerformance) => string,
  labelOf: (r: EmployeePerformance) => string,
  subLabelOf?: (r: EmployeePerformance) => string
): GroupPerformance[] {
  const map = new Map<string, GroupAgg>();

  for (const r of rows) {
    const key = keyOf(r);
    const entry: GroupAgg =
      map.get(key) ??
      {
        label: labelOf(r),
        subLabel: subLabelOf?.(r),
        employees: 0,
        scores: [],
        prevScores: [],
        kpiTotals: new Map(),
      };

    entry.employees += 1;
    if (r.score !== null) entry.scores.push(r.score);
    if (r.prevScore !== null) entry.prevScores.push(r.prevScore);
    for (const item of r.kpis) {
      const agg = entry.kpiTotals.get(item.name) ?? { sum: 0, count: 0 };
      agg.sum += item.achievement;
      agg.count += 1;
      entry.kpiTotals.set(item.name, agg);
    }

    map.set(key, entry);
  }

  return [...map.entries()].map(([key, entry]) => {
    let weakestKpi: KpiHighlight | null = null;
    for (const [name, agg] of entry.kpiTotals) {
      const achievement = agg.sum / agg.count;
      if (!weakestKpi || achievement < weakestKpi.achievement) {
        weakestKpi = { name, achievement };
      }
    }
    const avgScore = average(entry.scores);
    const prevAvgScore = average(entry.prevScores);
    return {
      key,
      label: entry.label,
      subLabel: entry.subLabel,
      avgScore,
      prevAvgScore,
      deltaPct: relativeDelta(avgScore, prevAvgScore),
      scored: entry.scores.length,
      employees: entry.employees,
      weakestKpi,
    };
  });
}

/** Skor tertinggi dulu; kelompok tanpa nilai selalu di akhir. */
const byScoreDesc = (a: GroupPerformance, b: GroupPerformance) => {
  if (a.avgScore === null && b.avgScore === null) return a.label.localeCompare(b.label, "id");
  if (a.avgScore === null) return 1;
  if (b.avgScore === null) return -1;
  return b.avgScore - a.avgScore;
};

/** Skor terendah dulu — yang paling perlu ditindaklanjuti ada di atas. */
const byScoreAsc = (a: GroupPerformance, b: GroupPerformance) => {
  if (a.avgScore === null && b.avgScore === null) return a.label.localeCompare(b.label, "id");
  if (a.avgScore === null) return 1;
  if (b.avgScore === null) return -1;
  return a.avgScore - b.avgScore;
};

/**
 * Ringkasan dari sekumpulan baris karyawan — apa pun filternya.
 *
 * Karyawan tanpa skor tetap dihitung sebagai anggota kelompok (`employees`)
 * tapi tidak ikut menarik rata-rata; itulah beda `scored` dan `employees`.
 */
export function aggregatePerformance(rows: EmployeePerformance[]): PerformanceAggregate {
  const scored = rows.filter((r) => r.score !== null);
  const avgScore = average(rows.map((r) => r.score).filter((v): v is number => v !== null));
  const prevAvgScore = average(rows.map((r) => r.prevScore).filter((v): v is number => v !== null));

  const gradeCounts = { A: 0, B: 0, C: 0, D: 0 };
  for (const r of scored) {
    if (r.grade && r.grade in gradeCounts) {
      gradeCounts[r.grade as keyof typeof gradeCounts] += 1;
    }
  }

  const periodCount = rows[0]?.history.length ?? 0;
  const history = Array.from({ length: periodCount }, (_, i) =>
    average(rows.map((r) => r.history[i]).filter((v): v is number => v != null))
  );

  return {
    totals: {
      employees: rows.length,
      scored: scored.length,
      unscored: rows.length - scored.length,
      avgScore,
      prevAvgScore,
      avgDeltaPct: relativeDelta(avgScore, prevAvgScore),
      gradeCounts,
      history,
    },
    byCompany: collect(
      rows,
      (r) => r.companyId ?? NO_COMPANY,
      (r) => r.companyName
    ).sort(byScoreDesc),
    byRole: collect(
      rows,
      (r) => r.roleName,
      (r) => r.roleName
    ).sort(byScoreAsc),
    byRoleCompany: collect(
      rows,
      (r) => `${r.roleName}::${r.companyId ?? NO_COMPANY}`,
      (r) => r.roleName,
      (r) => r.companyName
    ).sort(byScoreAsc),
  };
}
