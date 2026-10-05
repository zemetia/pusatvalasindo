import prisma from "@/lib/prisma";
import { kpiService } from "@/backend/services/kpi.service";
import { MONTH_NAMES } from "@/lib/kpi-utils";
import type { KpiBreakdown } from "@/lib/kpi-utils";
import type { ScoredKpiItem } from "@/lib/kpi-scoring";
import {
  relativeDelta,
  buildRoleSummary,
  extractOmzetStats,
  extractKurirStats,
} from "@/lib/kpi-analytics";
import { slugifyRoleName } from "@/lib/kpi-utils";
import type {
  EmployeePerformance,
  PerformanceOverview,
  PeriodRef,
  RoleKpiSummary,
} from "@/lib/kpi-analytics";

/**
 * Bahan halaman Analisis Kinerja.
 *
 * Modul KPI lain bekerja per orang per bulan; di sini justru kebalikannya —
 * seluruh karyawan dalam satu periode, plus riwayat beberapa bulan ke belakang
 * supaya angka bulan ini punya konteks.
 *
 * Sengaja hanya beberapa query untuk seluruh halaman (hasil KPI, daftar
 * karyawan, dan log entri bulan berjalan), sisanya dihitung di memori.
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

    // Periode yang sedang dilihat harus selalu punya angka, terlepas dari
    // apakah Gaji sudah dihitung atau ada yang sempat klik "Hitung Ulang" —
    // KPI tidak boleh kosong hanya karena belum pernah dipicu. Periode
    // riwayat di baliknya dibiarkan apa adanya, sudah pasti terisi lewat
    // alur normal (entri disetujui / gaji bulan itu sudah berjalan).
    await kpiService.ensureMonthlyResults(current.month, current.year);

    const [results, employees, entries] = await Promise.all([
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
          customRole: {
            select: {
              name: true,
              companyId: true,
              company: { select: { name: true, code: true } },
            },
          },
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
      prisma.kpiEntry.findMany({
        where: {
          periodMonth: current.month,
          periodYear: current.year,
          status: "APPROVED",
        },
        select: {
          employeeId: true,
          quantity: true,
          note: true,
          occurredAt: true,
          status: true,
        },
        orderBy: { occurredAt: "desc" },
      }),
    ]);

    // employeeId → periodKey → hasil
    const byEmployee = new Map<string, Map<string, (typeof results)[number]>>();
    for (const r of results) {
      const perPeriod = byEmployee.get(r.employeeId) ?? new Map();
      perPeriod.set(periodKey(r), r);
      byEmployee.set(r.employeeId, perPeriod);
    }

    const entriesByEmployee = new Map<
      string,
      Array<{ quantity: number; note: string | null; occurredAt: Date }>
    >();
    for (const entry of entries) {
      const list = entriesByEmployee.get(entry.employeeId) ?? [];
      list.push({
        quantity: Number(entry.quantity),
        note: entry.note,
        occurredAt: entry.occurredAt,
      });
      entriesByEmployee.set(entry.employeeId, list);
    }

    const currentKey = periodKey(current);
    const prevKey = periodKey(previous);

    const rows: EmployeePerformance[] = employees.map((e) => {
      const perPeriod = byEmployee.get(e.id);
      const now = perPeriod?.get(currentKey);
      const before = perPeriod?.get(prevKey);

      const score = now ? Number(now.totalScore) : null;
      const prevScore = before ? Number(before.totalScore) : null;

      const empEntries = entriesByEmployee.get(e.id) ?? [];
      const breakdown = now?.breakdownJson as KpiBreakdown | null;
      const scoredItems = Array.isArray(breakdown?.items)
        ? (breakdown.items as ScoredKpiItem[])
        : [];

      const omzetStats = extractOmzetStats(scoredItems);
      const kurirSummary = extractKurirStats(
        e.customRole?.name ?? "",
        scoredItems,
        empEntries
      );

      return {
        employeeId: e.id,
        name: e.name,
        roleName: e.customRole?.name ?? "—",
        branchId: e.branch?.id ?? null,
        branchName: e.branch?.name ?? "Tanpa cabang",
        companyId: e.branch?.companyId ?? e.customRole?.companyId ?? null,
        companyCode: e.branch?.company?.code ?? e.customRole?.company?.code ?? "—",
        companyName: e.branch?.company?.name ?? e.customRole?.company?.name ?? "Tanpa PT",
        score,
        grade: now?.grade ?? null,
        prevScore,
        deltaPct: relativeDelta(score, prevScore),
        kpis: scoredKpis(now?.breakdownJson),
        history: periods.map((p) => {
          const r = perPeriod?.get(periodKey(p));
          return r ? Number(r.totalScore) : null;
        }),
        omzetTarget: omzetStats.target,
        omzetActual: omzetStats.actual,
        omzetAchievement: omzetStats.achievement,
        kurirSummary,
        breakdownItems: scoredItems,
      };
    });

    return {
      period: { ...current, label: `${MONTH_NAMES[current.month]} ${current.year}` },
      historyLabels: periods.map(shortLabel),
      rows,
    };
  },

  /**
   * Ringkasan KPI satu jabatan (dicocokkan lewat slug nama, lintas PT bila
   * ada beberapa perusahaan memakai nama jabatan yang sama). `null` kalau
   * tidak ada jabatan dengan slug tersebut sama sekali — beda dari "ada
   * jabatannya tapi belum ada karyawan/hasil", yang tetap mengembalikan
   * ringkasan kosong supaya halamannya bisa menjelaskan itu.
   */
  getRoleSummary: async (
    roleSlug: string,
    month: number,
    year: number
  ): Promise<RoleKpiSummary | null> => {
    const customRoles = await prisma.custom_role.findMany({ select: { name: true } });
    const roleName = [...new Set(customRoles.map((r) => r.name))].find(
      (n) => slugifyRoleName(n) === roleSlug
    );
    if (!roleName) return null;

    const overview = await kpiAnalyticsService.getPerformanceOverview(month, year);
    const matches = overview.rows.filter((r) => r.roleName === roleName);

    return buildRoleSummary(roleName, overview.period, overview.historyLabels, matches);
  },
};
