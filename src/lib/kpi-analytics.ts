/**
 * Bentuk data & agregasi untuk halaman Analisis Kinerja.
 *
 * Agregatnya ditaruh di sini, bukan di service, karena halaman menghitungnya
 * ulang setiap kali filter berubah — memfilter PT lalu tetap menampilkan
 * rata-rata seluruh perusahaan membuat angkanya menyesatkan. Server hanya
 * mengirim baris per karyawan; totals, per-PT, dan per-jabatan diturunkan dari
 * baris yang lolos filter, di server maupun di client, lewat fungsi yang sama.
 */

import type { ScoredKpiItem } from "@/lib/kpi-scoring";

export type PeriodRef = { month: number; year: number };

export type KpiHighlight = { name: string; achievement: number };

export type KurirRouteLog = {
  date: string;
  quantity: number;
  note: string;
};

export type KurirRouteSummary = {
  route: string;
  count: number;
  volume: number;
};

export type KurirSummary = {
  totalVolume: number;
  activeDays: number;
  deliveryTarget: number | null;
  deliveryActual: number | null;
  deliveryAchievement: number | null;
  routes: KurirRouteSummary[];
  recentLogs: KurirRouteLog[];
};

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
  /** Nilai target omzet / currency bulanan dalam rupiah. */
  omzetTarget?: number | null;
  /** Realisasi omzet / currency bulanan dalam rupiah. */
  omzetActual?: number | null;
  /** Rasio pencapaian omzet (realisasi / target). */
  omzetAchievement?: number | null;
  /** Rangkuman pengiriman & rute kurir dari breakdownJson & kpiEntry. */
  kurirSummary?: KurirSummary | null;
  /** Daftar seluruh item KPI berbobot yang sudah dinilai. */
  breakdownItems?: ScoredKpiItem[];
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

/**
 * Ringkasan KPI satu jabatan (lintas PT, kalau namanya dipakai lebih dari
 * satu perusahaan). Beda dari `PerformanceOverview` biasa: setiap KPI
 * berbobot milik jabatan ini punya kolomnya sendiri, bukan cuma "KPI
 * terlemah" satu baris.
 */
export type RoleKpiSummary = {
  roleName: string;
  period: PeriodRef & { label: string };
  historyLabels: string[];
  /** Nama KPI berbobot milik jabatan ini, urut dari rata-rata terendah. */
  kpiColumns: string[];
  /** Rata-rata pencapaian tiap KPI di kolom, `null` bila tak ada data. */
  kpiAverages: Record<string, number | null>;
  rows: (EmployeePerformance & { kpiByName: Record<string, number | null> })[];
  totals: PerformanceTotals;
  byCompany: GroupPerformance[];
};

/**
 * Bangun ringkasan per-jabatan dari baris `EmployeePerformance` yang sudah
 * difilter ke satu nama jabatan. Dipisah dari service supaya bisa diuji
 * tanpa database, sama seperti `aggregatePerformance`.
 */
export function buildRoleSummary(
  roleName: string,
  period: PeriodRef & { label: string },
  historyLabels: string[],
  matches: EmployeePerformance[]
): RoleKpiSummary {
  const { totals, byCompany } = aggregatePerformance(matches);

  const kpiTotals = new Map<string, { sum: number; count: number }>();
  const rows = matches.map((r) => {
    const kpiByName: Record<string, number | null> = {};
    for (const item of r.kpis) {
      kpiByName[item.name] = item.achievement;
      const agg = kpiTotals.get(item.name) ?? { sum: 0, count: 0 };
      agg.sum += item.achievement;
      agg.count += 1;
      kpiTotals.set(item.name, agg);
    }
    return { ...r, kpiByName };
  });

  const kpiAverages: Record<string, number | null> = {};
  for (const [name, agg] of kpiTotals) {
    kpiAverages[name] = agg.count > 0 ? agg.sum / agg.count : null;
  }

  const kpiColumns = [...kpiTotals.keys()].sort((a, b) => {
    const av = kpiAverages[a];
    const bv = kpiAverages[b];
    if (av === null && bv === null) return a.localeCompare(b, "id");
    if (av === null) return 1;
    if (bv === null) return -1;
    return av - bv;
  });

  return { roleName, period, historyLabels, kpiColumns, kpiAverages, rows, totals, byCompany };
}

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

/* ── Rangkuman Eksekutif per Cabang & Jabatan ─────────────────────────────── */

export type CanonicalRoleCategory =
  | "KEPALA_CABANG"
  | "KEPALA_MARKETING"
  | "MARKETING"
  | "TELLER_LUAR"
  | "KURIR"
  | "TELLER_DALAM"
  | "LAINNYA";

export const ROLE_CATEGORY_META: Record<
  CanonicalRoleCategory,
  { label: string; order: number }
> = {
  KEPALA_CABANG: { label: "Kepala Cabang", order: 1 },
  KEPALA_MARKETING: { label: "Kepala Marketing", order: 2 },
  MARKETING: { label: "Marketing", order: 3 },
  TELLER_LUAR: { label: "Teller Luar", order: 4 },
  KURIR: { label: "Kurir", order: 5 },
  TELLER_DALAM: { label: "Teller Dalam", order: 6 },
  LAINNYA: { label: "Jabatan Lainnya", order: 7 },
};

export function categorizeRole(roleName: string): CanonicalRoleCategory {
  const clean = roleName.trim().toLowerCase();
  if (
    clean.includes("kepala cabang") ||
    clean.includes("branch manager") ||
    clean.includes("kacab")
  ) {
    return "KEPALA_CABANG";
  }
  if (
    clean.includes("kepala marketing") ||
    clean.includes("head of marketing") ||
    clean.includes("marketing head")
  ) {
    return "KEPALA_MARKETING";
  }
  if (
    clean.includes("marketing") ||
    clean.includes("sales") ||
    clean.includes("account executive")
  ) {
    return "MARKETING";
  }
  if (clean.includes("teller luar")) {
    return "TELLER_LUAR";
  }
  if (clean.includes("teller dalam") || clean.includes("kasir") || clean.includes("teller")) {
    return "TELLER_DALAM";
  }
  if (
    clean.includes("kurir") ||
    clean.includes("courier") ||
    clean.includes("logistik") ||
    clean.includes("delivery")
  ) {
    return "KURIR";
  }
  return "LAINNYA";
}

export function extractOmzetStats(items: ScoredKpiItem[] | undefined | null): {
  target: number | null;
  actual: number | null;
  achievement: number | null;
} {
  if (!Array.isArray(items) || items.length === 0) {
    return { target: null, actual: null, achievement: null };
  }
  // Only TARGET_VALUE KPIs represent omzet / sales turnover / profit margin.
  // TOLERANCE_LIMIT (e.g. kesesuaian-jumlah-kas) is a cash discrepancy tolerance, NOT turnover.
  const omzetItems = items.filter((i) => {
    if (i.scoringType !== "TARGET_VALUE") return false;
    const code = i.kpiCode?.toLowerCase() ?? "";
    const name = i.kpiName?.toLowerCase() ?? "";
    return (
      code === "jumlah-omzet" ||
      code === "net-profit-margin" ||
      name.includes("omzet") ||
      name.includes("profit margin") ||
      (i.unit === "CURRENCY" && !name.includes("kas"))
    );
  });

  if (omzetItems.length === 0) {
    return { target: null, actual: null, achievement: null };
  }

  const hasTarget = omzetItems.some((i) => i.reference !== null && i.reference !== undefined);
  const hasActual = omzetItems.some((i) => i.actual !== null && i.actual !== undefined);

  const target = hasTarget
    ? omzetItems.reduce((acc, i) => acc + (Number(i.reference) || 0), 0)
    : null;
  const actual = hasActual
    ? omzetItems.reduce((acc, i) => acc + (Number(i.actual) || 0), 0)
    : null;

  let achievement: number | null = null;
  if (target !== null && target > 0 && actual !== null) {
    achievement = actual / target;
  } else if (omzetItems[0].achievement !== null && omzetItems[0].achievement !== undefined) {
    achievement = Number(omzetItems[0].achievement);
  }

  return { target, actual, achievement };
}

export function extractKurirStats(
  roleName: string,
  items: ScoredKpiItem[] | undefined | null,
  entries: { quantity: number; note: string | null; occurredAt: Date | string }[]
): KurirSummary | null {
  const isKurir =
    roleName.toLowerCase().includes("kurir") ||
    roleName.toLowerCase().includes("courier") ||
    roleName.toLowerCase().includes("logistik") ||
    roleName.toLowerCase().includes("delivery");

  if (!isKurir && entries.length === 0) {
    return null;
  }

  const deliveryItem = Array.isArray(items)
    ? items.find(
        (i) =>
          i.kpiCode === "ketepatan-pengiriman" ||
          i.kpiName.toLowerCase().includes("pengiriman") ||
          i.kpiCode.includes("pengiriman")
      )
    : null;

  const totalVolumeFromEntries = entries.reduce(
    (sum, e) => sum + (Number(e.quantity) || 0),
    0
  );

  const activeDaysSet = new Set<string>();
  const routeMap = new Map<string, { route: string; count: number; volume: number }>();
  const recentLogs: KurirRouteLog[] = [];

  for (const en of entries) {
    const qty = Number(en.quantity) || 0;
    const dateStr =
      en.occurredAt instanceof Date
        ? en.occurredAt.toISOString().slice(0, 10)
        : String(en.occurredAt).slice(0, 10);

    if (qty > 0) {
      activeDaysSet.add(dateStr);
    }

    const rawNote = en.note?.trim();
    if (rawNote) {
      // Normalize whitespace and case-insensitive deduplication of routes
      const cleanNote = rawNote.replace(/\s+/g, " ");
      const normalizedKey = cleanNote.toLowerCase();
      const cur = routeMap.get(normalizedKey) ?? { route: cleanNote, count: 0, volume: 0 };
      cur.count += 1;
      cur.volume += qty;
      routeMap.set(normalizedKey, cur);
    }

    if (recentLogs.length < 50) {
      recentLogs.push({
        date: dateStr,
        quantity: qty,
        note: rawNote || "Pengiriman",
      });
    }
  }

  recentLogs.sort((a, b) => b.date.localeCompare(a.date));

  const routes: KurirRouteSummary[] = [...routeMap.values()]
    .map((val) => ({
      route: val.route,
      count: val.count,
      volume: val.volume,
    }))
    .sort((a, b) => b.volume - a.volume || b.count - a.count);

  const deliveryTarget =
    deliveryItem && deliveryItem.reference !== null && deliveryItem.reference !== undefined
      ? Number(deliveryItem.reference)
      : null;

  const deliveryActual =
    deliveryItem && deliveryItem.actual !== null && deliveryItem.actual !== undefined
      ? Number(deliveryItem.actual)
      : totalVolumeFromEntries;

  const deliveryAchievement =
    deliveryItem && deliveryItem.achievement !== null && deliveryItem.achievement !== undefined
      ? Number(deliveryItem.achievement)
      : deliveryTarget && deliveryTarget > 0
      ? deliveryActual / deliveryTarget
      : null;

  return {
    totalVolume: deliveryActual,
    activeDays: activeDaysSet.size,
    deliveryTarget,
    deliveryActual,
    deliveryAchievement,
    routes,
    recentLogs,
  };
}

export type MarketingContribution = {
  employeeId: string;
  name: string;
  branchName: string;
  score: number | null;
  grade: string | null;
  target: number | null;
  actual: number | null;
  achievement: number | null;
  contributionPct: number;
};

export type KurirPersonilDetail = {
  employeeId: string;
  name: string;
  branchName: string;
  score: number | null;
  grade: string | null;
  summary: KurirSummary;
};

export type RoleSectionSummary = {
  category: CanonicalRoleCategory;
  title: string;
  employees: EmployeePerformance[];
  avgScore: number | null;
  totalTarget: number;
  totalActual: number;
  omzetAchievement: number | null;
  marketingContributions?: MarketingContribution[];
  kurirBreakdowns?: KurirPersonilDetail[];
  kurirTotalVolume?: number;
  kurirTotalActiveDays?: number;
};

export type BranchExecutiveSummary = {
  branchId: string;
  branchName: string;
  companyId: string | null;
  companyCode: string;
  companyName: string;
  employeeCount: number;
  scoredCount: number;
  avgScore: number | null;
  totalOmzetTarget: number;
  totalOmzetActual: number;
  sections: RoleSectionSummary[];
};

export type CompanyExecutiveSummary = {
  companyId: string;
  companyCode: string;
  companyName: string;
  employeeCount: number;
  scoredCount: number;
  avgScore: number | null;
  totalOmzetTarget: number;
  totalOmzetActual: number;
  sections: RoleSectionSummary[];
  branches: BranchExecutiveSummary[];
};

export type ExecutiveSummary = {
  companies: CompanyExecutiveSummary[];
  overallTotals: {
    employeeCount: number;
    scoredCount: number;
    avgScore: number | null;
    totalOmzetTarget: number;
    totalOmzetActual: number;
  };
};

export function buildRoleSection(
  category: CanonicalRoleCategory,
  employees: EmployeePerformance[]
): RoleSectionSummary | null {
  if (employees.length === 0) return null;

  const title = ROLE_CATEGORY_META[category].label;
  const scored = employees.filter((e) => e.score !== null);
  const avgScore = average(scored.map((e) => e.score as number));

  let totalTarget = 0;
  let totalActual = 0;
  let hasOmzet = false;

  for (const e of employees) {
    if (e.omzetTarget !== null && e.omzetTarget !== undefined) {
      totalTarget += e.omzetTarget;
      hasOmzet = true;
    }
    if (e.omzetActual !== null && e.omzetActual !== undefined) {
      totalActual += e.omzetActual;
      hasOmzet = true;
    }
  }

  const omzetAchievement =
    hasOmzet && totalTarget > 0 ? totalActual / totalTarget : null;

  let marketingContributions: MarketingContribution[] | undefined;
  if (category === "MARKETING") {
    marketingContributions = employees.map((e) => {
      const actual = e.omzetActual ?? null;
      const target = e.omzetTarget ?? null;
      const achievement =
        e.omzetAchievement ??
        (target && target > 0 && actual !== null ? actual / target : null);
      const contributionPct =
        totalActual > 0 && actual !== null && actual > 0
          ? (actual / totalActual) * 100
          : 0;

      return {
        employeeId: e.employeeId,
        name: e.name,
        branchName: e.branchName,
        score: e.score,
        grade: e.grade,
        target,
        actual,
        achievement,
        contributionPct,
      };
    });
  }

  let kurirBreakdowns: KurirPersonilDetail[] | undefined;
  let kurirTotalVolume: number | undefined;
  let kurirTotalActiveDays: number | undefined;

  if (category === "KURIR") {
    const kurirList: KurirPersonilDetail[] = [];
    let vol = 0;
    let days = 0;
    for (const e of employees) {
      if (e.kurirSummary) {
        kurirList.push({
          employeeId: e.employeeId,
          name: e.name,
          branchName: e.branchName,
          score: e.score,
          grade: e.grade,
          summary: e.kurirSummary,
        });
        vol += e.kurirSummary.totalVolume;
        days += e.kurirSummary.activeDays;
      }
    }
    kurirBreakdowns = kurirList;
    kurirTotalVolume = vol;
    kurirTotalActiveDays = days;
  }

  return {
    category,
    title,
    employees,
    avgScore,
    totalTarget,
    totalActual,
    omzetAchievement,
    marketingContributions,
    kurirBreakdowns,
    kurirTotalVolume,
    kurirTotalActiveDays,
  };
}

export function buildExecutiveSummary(rows: EmployeePerformance[]): ExecutiveSummary {
  const companyMap = new Map<
    string,
    { code: string; name: string; rows: EmployeePerformance[] }
  >();

  for (const r of rows) {
    const cid = r.companyId ?? NO_COMPANY;
    const existing = companyMap.get(cid) ?? {
      code: r.companyCode,
      name: r.companyName,
      rows: [],
    };
    existing.rows.push(r);
    companyMap.set(cid, existing);
  }

  const roleCategoriesOrder: CanonicalRoleCategory[] = [
    "KEPALA_CABANG",
    "KEPALA_MARKETING",
    "MARKETING",
    "TELLER_LUAR",
    "KURIR",
    "TELLER_DALAM",
    "LAINNYA",
  ];

  const companies: CompanyExecutiveSummary[] = [];

  for (const [companyId, comp] of companyMap.entries()) {
    const compRows = comp.rows;
    const scoredComp = compRows.filter((r) => r.score !== null);
    const avgScore = average(scoredComp.map((r) => r.score as number));

    // Role sections at company level
    const compSections: RoleSectionSummary[] = [];
    for (const cat of roleCategoriesOrder) {
      const catEmployees = compRows.filter((r) => categorizeRole(r.roleName) === cat);
      const section = buildRoleSection(cat, catEmployees);
      if (section) {
        compSections.push(section);
      }
    }

    // Branch breakdowns within company
    const branchMap = new Map<string, { name: string; rows: EmployeePerformance[] }>();
    for (const r of compRows) {
      const bid = r.branchId ?? NO_BRANCH;
      const bExisting = branchMap.get(bid) ?? {
        name: r.branchName,
        rows: [],
      };
      bExisting.rows.push(r);
      branchMap.set(bid, bExisting);
    }

    const branches: BranchExecutiveSummary[] = [];
    for (const [branchId, b] of branchMap.entries()) {
      const bRows = b.rows;
      const bScored = bRows.filter((r) => r.score !== null);
      const bAvgScore = average(bScored.map((r) => r.score as number));

      // If branch has Kepala Cabang with omzet, that defines the branch target & actual omzet.
      // Otherwise, sum omzet from the sales / operational roles in this branch.
      const kacabInBranch = bRows.find(
        (r) =>
          categorizeRole(r.roleName) === "KEPALA_CABANG" &&
          (r.omzetTarget != null || r.omzetActual != null)
      );
      let bOmzetTarget = 0;
      let bOmzetActual = 0;
      if (kacabInBranch) {
        bOmzetTarget = kacabInBranch.omzetTarget ?? 0;
        bOmzetActual = kacabInBranch.omzetActual ?? 0;
      } else {
        for (const r of bRows) {
          if (r.omzetTarget) bOmzetTarget += r.omzetTarget;
          if (r.omzetActual) bOmzetActual += r.omzetActual;
        }
      }

      const bSections: RoleSectionSummary[] = [];
      for (const cat of roleCategoriesOrder) {
        const catEmployees = bRows.filter((r) => categorizeRole(r.roleName) === cat);
        const section = buildRoleSection(cat, catEmployees);
        if (section) {
          bSections.push(section);
        }
      }

      branches.push({
        branchId,
        branchName: b.name,
        companyId: companyId === NO_COMPANY ? null : companyId,
        companyCode: comp.code,
        companyName: comp.name,
        employeeCount: bRows.length,
        scoredCount: bScored.length,
        avgScore: bAvgScore,
        totalOmzetTarget: bOmzetTarget,
        totalOmzetActual: bOmzetActual,
        sections: bSections,
      });
    }

    branches.sort((a, b) => a.branchName.localeCompare(b.branchName, "id"));

    // Company level omzet: sum of its branch omzets (or fallback to row sum if no branches)
    let compTotalTarget = branches.reduce((sum, b) => sum + b.totalOmzetTarget, 0);
    let compTotalActual = branches.reduce((sum, b) => sum + b.totalOmzetActual, 0);

    if (branches.length === 0) {
      for (const r of compRows) {
        if (r.omzetTarget) compTotalTarget += r.omzetTarget;
        if (r.omzetActual) compTotalActual += r.omzetActual;
      }
    }

    companies.push({
      companyId: companyId === NO_COMPANY ? "" : companyId,
      companyCode: comp.code,
      companyName: comp.name,
      employeeCount: compRows.length,
      scoredCount: scoredComp.length,
      avgScore,
      totalOmzetTarget: compTotalTarget,
      totalOmzetActual: compTotalActual,
      sections: compSections,
      branches,
    });
  }

  const companyPriority: Record<string, number> = {
    PVI: 1,
    PTU: 2,
    PKD: 3,
  };
  companies.sort((a, b) => {
    const prioA = companyPriority[a.companyCode] ?? 99;
    const prioB = companyPriority[b.companyCode] ?? 99;
    if (prioA !== prioB) return prioA - prioB;
    return a.companyName.localeCompare(b.companyName, "id");
  });

  const allScored = rows.filter((r) => r.score !== null);
  const overallAvgScore = average(allScored.map((r) => r.score as number));
  const overallTarget = companies.reduce((sum, c) => sum + c.totalOmzetTarget, 0);
  const overallActual = companies.reduce((sum, c) => sum + c.totalOmzetActual, 0);

  return {
    companies,
    overallTotals: {
      employeeCount: rows.length,
      scoredCount: allScored.length,
      avgScore: overallAvgScore,
      totalOmzetTarget: overallTarget,
      totalOmzetActual: overallActual,
    },
  };
}

