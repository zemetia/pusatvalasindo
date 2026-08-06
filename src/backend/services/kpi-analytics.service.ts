import prisma from "@/lib/prisma";
import { MONTH_NAMES } from "@/lib/kpi-utils";
import type { KpiBreakdown } from "@/lib/kpi-utils";
import { relativeDelta } from "@/lib/kpi-analytics";
import type {
  EmployeePerformance,
  PerformanceOverview,
  PeriodRef,
} from "@/lib/kpi-analytics";

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
 *
 * Yang dikirim ke halaman hanya baris per karyawan. Ringkasan per PT, per
 * jabatan, dan totalnya dihitung dari baris yang lolos filter di layar
 * (`aggregatePerformance` di `@/lib/kpi-analytics`) — kalau dihitung di sini,
 * memfilter satu PT akan tetap menampilkan rata-rata seluruh perusahaan.
 */

const HISTORY_MONTHS = 6;

export type { PerformanceOverview };

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

/**
 * KPI berbobot pada satu hasil, urut dari pencapaian terendah — bobot nol tidak
 * mempengaruhi apa pun, jadi tidak layak muncul sebagai "KPI terlemah".
 */
function scoredKpis(breakdown: unknown) {
  const items = (breakdown as KpiBreakdown | null)?.items;
  if (!Array.isArray(items)) return [];
  return items
    .filter((i) => Number(i.weight) > 0)
    .map((i) => ({ name: i.kpiName, achievement: i.achievement }))
    .sort((a, b) => a.achievement - b.achievement);
}

export const kpiAnalyticsService = {
  /**
   * Kinerja seluruh karyawan pada satu periode.
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

      return {
        employeeId: e.id,
        name: e.name,
        roleName: e.customRole?.name ?? "—",
        branchId: e.branch?.id ?? null,
        branchName: e.branch?.name ?? "Tanpa cabang",
        companyId: e.branch?.companyId ?? null,
        companyCode: e.branch?.company?.code ?? "—",
        companyName: e.branch?.company?.name ?? "Tanpa PT",
        score,
        grade: now?.grade ?? null,
        prevScore,
        deltaPct: relativeDelta(score, prevScore),
        kpis: scoredKpis(now?.breakdownJson),
        history: periods.map((p) => {
          const r = perPeriod?.get(periodKey(p));
          return r ? Number(r.totalScore) : null;
        }),
      };
    });

    return {
      period: { ...current, label: `${MONTH_NAMES[current.month]} ${current.year}` },
      historyLabels: periods.map(shortLabel),
      rows,
    };
  },
};
