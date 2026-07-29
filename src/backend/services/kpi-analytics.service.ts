import prisma from "@/lib/prisma";
import { MONTH_NAMES } from "@/lib/kpi-utils";
import type { KpiBreakdown } from "@/lib/kpi-utils";

/**
 * Bahan halaman Analisis Kinerja.
 *
 * Modul KPI lain bekerja per orang per bulan; di sini justru kebalikannya —
 * seluruh karyawan dalam satu periode, plus riwayat beberapa bulan ke belakang
 * supaya angka bulan ini punya konteks.
 *
 * Sengaja hanya **dua query** untuk seluruh halaman (hasil KPI + daftar
 * karyawan), sisanya dihitung di memori. Database-nya remote, jadi jumlah
 * round-trip yang menentukan waktu buka halaman, bukan besar datanya: satu
 * periode paling banter puluhan baris per bulan.
 */

const HISTORY_MONTHS = 6;

export type PeriodRef = { month: number; year: number };

export type KpiHighlight = { name: string; achievement: number };

export type EmployeePerformance = {
  employeeId: string;
  name: string;
  roleName: string;
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
  weakest: KpiHighlight | null;
  strongest: KpiHighlight | null;
  /** Skor 6 bulan terakhir, urut lama → baru. `null` untuk bulan tanpa hasil. */
  history: (number | null)[];
};

export type CompanyPerformance = {
  companyId: string;
  code: string;
  name: string;
  avgScore: number | null;
  prevAvgScore: number | null;
  deltaPct: number | null;
  scored: number;
  employees: number;
};

export type RolePerformance = {
  roleName: string;
  avgScore: number | null;
  scored: number;
  employees: number;
  /** KPI dengan pencapaian rata-rata terendah pada jabatan ini. */
  weakestKpi: KpiHighlight | null;
};

export type PerformanceOverview = {
  period: PeriodRef & { label: string };
  historyLabels: string[];
  totals: {
    employees: number;
    scored: number;
    unscored: number;
    avgScore: number | null;
    prevAvgScore: number | null;
    avgDeltaPct: number | null;
    gradeCounts: { A: number; B: number; C: number; D: number };
  };
  byCompany: CompanyPerformance[];
  byRole: RolePerformance[];
  rows: EmployeePerformance[];
};

/**
 * Daftar periode dari yang paling lama ke paling baru, termasuk periode acuan.
 * Di-ekspor karena pergantian tahun di sini gampang meleset satu bulan dan
 * kesalahannya tidak kelihatan di layar — lihat kpi-analytics.test.ts.
 */
export function buildPeriods(month: number, year: number, count: number): PeriodRef[] {
  const periods: PeriodRef[] = [];
  for (let back = count - 1; back >= 0; back--) {
    const zeroBased = month - 1 - back;
    periods.push({
      month: ((zeroBased % 12) + 12) % 12 + 1,
      year: year + Math.floor(zeroBased / 12),
    });
  }
  return periods;
}

function periodKey(p: PeriodRef) {
  return `${p.year}-${p.month}`;
}

function shortLabel(p: PeriodRef) {
  return `${MONTH_NAMES[p.month].slice(0, 3)} ${String(p.year).slice(2)}`;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Perubahan relatif dalam persen. `null` bila tidak ada pembanding yang sah —
 * pembagian dengan nol akan memberi `Infinity`, dan DeltaPill sudah dirancang
 * untuk menampilkan em dash saat nilainya bukan angka berhingga.
 */
function relativeDelta(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

/** Item breakdown yang layak dinilai — bobot nol tidak mempengaruhi apa pun. */
function scoredItems(breakdown: unknown) {
  const items = (breakdown as KpiBreakdown | null)?.items;
  if (!Array.isArray(items)) return [];
  return items.filter((i) => Number(i.weight) > 0);
}

export const kpiAnalyticsService = {
  /**
   * Ringkasan kinerja seluruh karyawan pada satu periode.
   *
   * Karyawan yang belum punya hasil tetap muncul dengan skor `null` — justru
   * itu informasi yang dicari pemilik ("siapa yang belum dinilai"), jadi tidak
   * boleh hilang dari daftar.
   */
  getPerformanceOverview: async (
    month: number,
    year: number
  ): Promise<PerformanceOverview> => {
    const periods = buildPeriods(month, year, HISTORY_MONTHS);
    const current = periods[periods.length - 1];
    const previous = periods[periods.length - 2];

    const [results, employees] = await Promise.all([
      prisma.kpiMonthlyResult.findMany({
        where: { OR: periods.map((p) => ({ month: p.month, year: p.year })) },
        select: {
          employeeId: true,
          month: true,
          year: true,
          totalScore: true,
          grade: true,
          breakdownJson: true,
        },
      }),
      prisma.user.findMany({
        where: { isActive: true, customRoleId: { not: null } },
        select: {
          id: true,
          name: true,
          customRole: { select: { name: true } },
          branch: {
            select: {
              id: true,
              name: true,
              companyId: true,
              company: { select: { name: true, code: true } },
            },
          },
        },
        orderBy: { name: "asc" },
      }),
    ]);

    // employeeId → periodKey → hasil
    const byEmployee = new Map<string, Map<string, (typeof results)[number]>>();
    for (const r of results) {
      const perPeriod = byEmployee.get(r.employeeId) ?? new Map();
      perPeriod.set(periodKey(r), r);
      byEmployee.set(r.employeeId, perPeriod);
    }

    const currentKey = periodKey(current);
    const prevKey = periodKey(previous);

    const rows: EmployeePerformance[] = employees.map((e) => {
      const perPeriod = byEmployee.get(e.id);
      const now = perPeriod?.get(currentKey);
      const before = perPeriod?.get(prevKey);

      const score = now ? Number(now.totalScore) : null;
      const prevScore = before ? Number(before.totalScore) : null;

      const items = scoredItems(now?.breakdownJson);
      const sorted = [...items].sort((a, b) => a.achievement - b.achievement);
      const toHighlight = (i: (typeof items)[number] | undefined): KpiHighlight | null =>
        i ? { name: i.kpiName, achievement: i.achievement } : null;

      return {
        employeeId: e.id,
        name: e.name,
        roleName: e.customRole?.name ?? "—",
        branchId: e.branch?.id ?? null,
        branchName: e.branch?.name ?? "—",
        companyId: e.branch?.companyId ?? null,
        companyCode: e.branch?.company?.code ?? "—",
        companyName: e.branch?.company?.name ?? "Tanpa PT",
        score,
        grade: now?.grade ?? null,
        prevScore,
        deltaPct: relativeDelta(score, prevScore),
        weakest: toHighlight(sorted[0]),
        strongest: toHighlight(sorted[sorted.length - 1]),
        history: periods.map((p) => {
          const r = perPeriod?.get(periodKey(p));
          return r ? Number(r.totalScore) : null;
        }),
      };
    });

    // ── Ringkasan keseluruhan ──
    const scoredRows = rows.filter((r) => r.score !== null);
    const avgScore = average(scoredRows.map((r) => r.score!));
    const prevScored = rows.filter((r) => r.prevScore !== null);
    const prevAvgScore = average(prevScored.map((r) => r.prevScore!));

    const gradeCounts = { A: 0, B: 0, C: 0, D: 0 };
    for (const r of scoredRows) {
      if (r.grade && r.grade in gradeCounts) {
        gradeCounts[r.grade as keyof typeof gradeCounts] += 1;
      }
    }

    // ── Per PT ──
    const companyMap = new Map<string, CompanyPerformance & { scores: number[]; prevScores: number[] }>();
    for (const r of rows) {
      if (!r.companyId) continue;
      const entry =
        companyMap.get(r.companyId) ??
        {
          companyId: r.companyId,
          code: r.companyCode,
          name: r.companyName,
          avgScore: null,
          prevAvgScore: null,
          deltaPct: null,
          scored: 0,
          employees: 0,
          scores: [] as number[],
          prevScores: [] as number[],
        };
      entry.employees += 1;
      if (r.score !== null) {
        entry.scored += 1;
        entry.scores.push(r.score);
      }
      if (r.prevScore !== null) entry.prevScores.push(r.prevScore);
      companyMap.set(r.companyId, entry);
    }

    const byCompany: CompanyPerformance[] = [...companyMap.values()]
      .map(({ scores, prevScores, ...rest }) => {
        const avg = average(scores);
        const prevAvg = average(prevScores);
        return { ...rest, avgScore: avg, prevAvgScore: prevAvg, deltaPct: relativeDelta(avg, prevAvg) };
      })
      .sort((a, b) => (b.avgScore ?? -1) - (a.avgScore ?? -1));

    // ── Per jabatan, termasuk KPI paling lemah di jabatan itu ──
    type RoleAgg = {
      scores: number[];
      employees: number;
      kpiTotals: Map<string, { sum: number; count: number }>;
    };
    const roleMap = new Map<string, RoleAgg>();
    for (const r of rows) {
      const entry: RoleAgg =
        roleMap.get(r.roleName) ?? { scores: [], employees: 0, kpiTotals: new Map() };
      entry.employees += 1;
      if (r.score !== null) entry.scores.push(r.score);

      const now = byEmployee.get(r.employeeId)?.get(currentKey);
      for (const item of scoredItems(now?.breakdownJson)) {
        const agg = entry.kpiTotals.get(item.kpiName) ?? { sum: 0, count: 0 };
        agg.sum += item.achievement;
        agg.count += 1;
        entry.kpiTotals.set(item.kpiName, agg);
      }
      roleMap.set(r.roleName, entry);
    }

    const byRole: RolePerformance[] = [...roleMap.entries()]
      .map(([roleName, entry]) => {
        let weakestKpi: KpiHighlight | null = null;
        for (const [name, agg] of entry.kpiTotals) {
          const avgAch = agg.sum / agg.count;
          if (!weakestKpi || avgAch < weakestKpi.achievement) {
            weakestKpi = { name, achievement: avgAch };
          }
        }
        return {
          roleName,
          avgScore: average(entry.scores),
          scored: entry.scores.length,
          employees: entry.employees,
          weakestKpi,
        };
      })
      .sort((a, b) => (a.avgScore ?? 99) - (b.avgScore ?? 99));

    return {
      period: { ...current, label: `${MONTH_NAMES[current.month]} ${current.year}` },
      historyLabels: periods.map(shortLabel),
      totals: {
        employees: rows.length,
        scored: scoredRows.length,
        unscored: rows.length - scoredRows.length,
        avgScore,
        prevAvgScore,
        avgDeltaPct: relativeDelta(avgScore, prevAvgScore),
        gradeCounts,
      },
      byCompany,
      byRole,
      rows,
    };
  },
};
