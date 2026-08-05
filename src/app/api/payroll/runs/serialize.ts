// Bentuk run payroll yang dikirim ke halaman.
//
// Dipisah dari route supaya halaman dan route memakai definisi yang sama —
// kolom Decimal Prisma harus diubah ke number sebelum menyeberang ke client,
// dan menuliskannya dua kali adalah cara paling gampang membuat keduanya
// menyimpang.

import type { payrollRunService } from "@/backend/services/payroll-run.service";

type RunRecord = NonNullable<Awaited<ReturnType<typeof payrollRunService.getRun>>>;

export type PayrollEntryView = {
  id: string;
  source: string;
  type: string;
  status: string;
  ruleId: string | null;
  ruleVersion: number | null;
  tier: string | null;
  label: string;
  amount: number;
  inputs: unknown;
  breakdown: unknown;
  formula: string | null;
  flag: string | null;
};

export type PayrollSlipView = {
  id: string;
  userId: string;
  employeeName: string;
  branchName: string;
  roleName: string;
  baseSalary: number;
  mealAllowance: number;
  transportAllowance: number;
  positionAllowance: number;
  bpjsKesehatan: number;
  totalBonus: number;
  totalPenalty: number;
  totalDeduction: number;
  totalAllowance: number;
  grossPay: number;
  netPay: number;
  needsReview: boolean;
  entries: PayrollEntryView[];
};

export type PayrollRunView = {
  id: string;
  companyId: string;
  periodMonth: number;
  periodYear: number;
  attempt: number;
  status: string;
  generatedAt: string;
  finalizedAt: string | null;
  paidAt: string | null;
  rulesetHash: string | null;
  slips: PayrollSlipView[];
  totalNetPay: number;
  jumlahPerluReview: number;
};

const n = (v: unknown) => Number(v ?? 0);

export function serializeRun(run: RunRecord): PayrollRunView {
  const slips: PayrollSlipView[] = run.slips.map((s) => ({
    id: s.id,
    userId: s.userId,
    employeeName: s.user.name,
    branchName: s.branch?.name ?? "—",
    roleName: s.customRole?.name ?? "Karyawan",
    baseSalary: n(s.baseSalary),
    mealAllowance: n(s.mealAllowance),
    transportAllowance: n(s.transportAllowance),
    positionAllowance: n(s.positionAllowance),
    bpjsKesehatan: n(s.bpjsKesehatan),
    totalBonus: n(s.totalBonus),
    totalPenalty: n(s.totalPenalty),
    totalDeduction: n(s.totalDeduction),
    totalAllowance: n(s.totalAllowance),
    grossPay: n(s.grossPay),
    netPay: n(s.netPay),
    needsReview: s.needsReview,
    entries: s.entries.map((e) => ({
      id: e.id,
      source: e.source,
      type: e.type,
      status: e.status,
      ruleId: e.ruleId,
      ruleVersion: e.ruleVersion,
      tier: e.tier,
      label: e.label,
      amount: n(e.amount),
      inputs: e.inputs,
      breakdown: e.breakdown,
      formula: e.formula,
      flag: e.flag,
    })),
  }));

  return {
    id: run.id,
    companyId: run.companyId,
    periodMonth: run.periodMonth,
    periodYear: run.periodYear,
    attempt: run.attempt,
    status: run.status,
    generatedAt: run.generatedAt.toISOString(),
    finalizedAt: run.finalizedAt?.toISOString() ?? null,
    paidAt: run.paidAt?.toISOString() ?? null,
    rulesetHash: run.rulesetHash,
    slips,
    // Dihitung dari slip, bukan disimpan — total yang diketik terpisah akan
    // basi begitu satu slip berubah.
    totalNetPay: slips.reduce((sum, s) => sum + s.netPay, 0),
    jumlahPerluReview: slips.filter((s) => s.needsReview).length,
  };
}
