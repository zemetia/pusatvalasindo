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

export function getGrade(score: number) {
  if (score >= 0.9) return { letter: "A", label: "Sangat Baik", className: "text-green-600" };
  if (score >= 0.75) return { letter: "B", label: "Baik", className: "text-blue-600" };
  if (score >= 0.6) return { letter: "C", label: "Cukup", className: "text-yellow-600" };
  return { letter: "D", label: "Kurang", className: "text-red-600" };
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export type BreakdownItem = {
  kpiId: string;
  kpiName: string;
  type: string;
  maxScore: string;
  threshold?: string;
  totalPenalty?: string;
  targetValue?: string;
  actual?: string;
  achievement?: string;
  score: string;
};

export type MonthlyResult = {
  id: string;
  month: number;
  year: number;
  totalScore: string;
  bonusAmount?: string | null;
  bonusResult?: string | null;
  breakdownJson: { items: BreakdownItem[] };
  calculatedAt: string;
};

export type PayrollResult = {
  employee: { id: string; name: string };
  period: { month: number; year: number };
  components: {
    baseSalary: number;
    mealAllowance: number;
    transportAllowance: number;
    totalGrossFixed: number;
    dailyRate: number;
  };
  kpi: {
    score: number;
    bonusAmount: number;
    bonusKpi: number;
    resultType: string | null;
    breakdownJson: { items: BreakdownItem[] };
    calculatedAt: string;
  };
  deductions: { late: number; absence: number; total: number };
  final: { takeHomePay: number };
  attendanceDetail: { totalDaysLogged: number };
};
