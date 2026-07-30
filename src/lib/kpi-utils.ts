import type { IncentiveResult } from "@/backend/services/payroll-incentive.service";
import type { ScoredKpiItem } from "@/lib/kpi-scoring";

export const MONTH_NAMES = [
  "",
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
] as const;

/**
 * Ambang grade. `score` adalah rasio pencapaian (1 = 100%), sama seperti yang
 * dihasilkan kpi-scoring — huruf yang tersimpan di KpiMonthlyResult.grade
 * dihitung dengan ambang yang sama (lihat gradeFor di kpi-scoring.ts).
 */
/**
 * `tone` mengikuti token semantik desain (lihat docs/blueprint/DATA_PRESENTATION.md)
 * supaya nilai grade bisa langsung dipakai `MetricBlock`/`MetricValue`.
 */
export type GradeTone = "success" | "info" | "warning" | "destructive";

export function getGrade(score: number): {
  letter: string;
  label: string;
  className: string;
  tone: GradeTone;
} {
  if (score >= 0.9)
    return { letter: "A", label: "Sangat Baik", className: "text-success", tone: "success" };
  if (score >= 0.75)
    return { letter: "B", label: "Baik", className: "text-info", tone: "info" };
  if (score >= 0.6)
    return { letter: "C", label: "Cukup", className: "text-warning", tone: "warning" };
  return { letter: "D", label: "Kurang", className: "text-destructive", tone: "destructive" };
}

export function gradeLabel(letter: string) {
  return (
    { A: "Sangat Baik", B: "Baik", C: "Cukup", D: "Kurang" }[letter] ?? "Belum Dinilai"
  );
}

export function gradeClassName(letter: string) {
  return (
    {
      A: "text-success",
      B: "text-info",
      C: "text-warning",
      D: "text-destructive",
    }[letter] ?? "text-muted-foreground"
  );
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Angka rupiah tanpa simbol — dipakai saat `Rp` dirender terpisah & meredup
 * sebagai prefix metrik editorial.
 */
export function formatAmount(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Persentase gaya id-ID: koma sebagai pemisah desimal, satu angka di belakang
 * koma (docs/blueprint/DATA_PRESENTATION.md §7).
 */
export function formatPercent(ratio: number, digits = 1) {
  return `${(ratio * 100).toFixed(digits).replace(".", ",")}%`;
}

export const SCORING_TYPE_LABELS: Record<string, string> = {
  TARGET_VALUE: "Target Nilai",
  PENALTY_POINT: "Penalti Poin",
  REWARD_POINT: "Reward Poin",
  PENALTY_PERCENT: "Penalti Persen",
  TOLERANCE_LIMIT: "Batas Toleransi",
  BOOLEAN_DAILY: "Checklist Harian",
};

export const INPUT_SOURCE_LABELS: Record<string, string> = {
  SELF: "Diisi sendiri",
  SUPERVISOR: "Diisi atasan",
  SYSTEM: "Otomatis sistem",
};

export const UNIT_LABELS: Record<string, string> = {
  OCCURRENCE: "kejadian",
  CURRENCY: "rupiah",
  POINT: "poin",
  PERCENT: "persen",
  DAY: "hari",
  PERSON: "orang",
};

/** Isi kolom breakdownJson pada KpiMonthlyResult. */
export type KpiBreakdown = {
  weightSum: number;
  items: ScoredKpiItem[];
  /** Ringkasan penarikan otomatis saat skor ini dihitung. */
  autoCollected?: {
    roleKpiId: string;
    kpiName: string;
    collectorLabel: string;
    entryCount: number;
    totalQuantity: number;
    skipped: { date: string; reason: string }[];
  }[];
  /** KPI bersumber sistem yang kolektornya belum tersedia. */
  autoUnsupported?: { kpiName: string; systemSourceKey: string | null }[];
};

export type MonthlyResult = {
  id: string;
  month: number;
  year: number;
  totalScore: string;
  grade: string;
  breakdownJson: KpiBreakdown;
  calculatedAt: string;
};

/** Satu baris tunjangan/potongan bernama di slip gaji. */
export type SalaryLineItem = { name: string; amount: number };

export type PayrollResult = {
  employee: { id: string; name: string };
  period: { month: number; year: number };
  components: {
    baseSalary: number;
    mealAllowance: number;
    transportAllowance: number;
    positionAllowance: number;
    bpjsKesehatan: number;
    /** Tunjangan tambahan dari komponen gaji custom (nominal tetap per bulan). */
    extraAllowances: SalaryLineItem[];
    totalExtraAllowance: number;
    totalGrossFixed: number;
    dailyRate: number;
  };
  kpi: {
    score: number;
    grade: string;
    breakdownJson: KpiBreakdown;
    calculatedAt: string;
  };
  /** Hasil konversi skor KPI → rupiah (bonus, potongan, top performer). */
  incentive: IncentiveResult;
  deductions: {
    late: number;
    absence: number;
    /** Potongan dari komponen gaji custom (koperasi, cicilan, dst.). */
    components: SalaryLineItem[];
    totalComponents: number;
    total: number;
  };
  final: { takeHomePay: number };
  attendanceDetail: { totalDaysLogged: number };
};
