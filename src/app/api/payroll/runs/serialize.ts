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
  paidAt: string | null;
  paidByName: string | null;
  entries: PayrollEntryView[];
};

type SlipDetailRecord = NonNullable<Awaited<ReturnType<typeof payrollRunService.getSlipDetail>>>;

export type PayrollSlipDetailView = PayrollSlipView & {
  runId: string;
  runStatus: string;
  companyName: string;
  periodMonth: number;
  periodYear: number;
  /** Tanggal masuk kerja karyawan — batas awal hari yang boleh dinilai alpha. */
  joinDate: string | null;
  /** Boleh ditambah/dihapus entri manual atau dihitung ulang. */
  canEdit: boolean;
};

export function serializeSlipDetail(slip: SlipDetailRecord): PayrollSlipDetailView {
  const canEdit = !slip.paidAt && slip.run.status !== "PAID" && slip.run.status !== "VOID";

  return {
    id: slip.id,
    userId: slip.userId,
    employeeName: slip.user.name,
    branchName: slip.branch?.name ?? "—",
    roleName: slip.customRole?.name ?? "Karyawan",
    baseSalary: n(slip.baseSalary),
    mealAllowance: n(slip.mealAllowance),
    transportAllowance: n(slip.transportAllowance),
    positionAllowance: n(slip.positionAllowance),
    bpjsKesehatan: n(slip.bpjsKesehatan),
    totalBonus: n(slip.totalBonus),
    totalPenalty: n(slip.totalPenalty),
    totalDeduction: n(slip.totalDeduction),
    totalAllowance: n(slip.totalAllowance),
    grossPay: n(slip.grossPay),
    netPay: n(slip.netPay),
    needsReview: slip.needsReview,
    paidAt: slip.paidAt?.toISOString() ?? null,
    paidByName: slip.paidBy?.name ?? null,
    entries: slip.entries.map((e) => ({
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
    runId: slip.run.id,
    runStatus: slip.run.status,
    companyName: slip.run.company.name,
    periodMonth: slip.run.periodMonth,
    periodYear: slip.run.periodYear,
    joinDate: slip.user.joinDate?.toISOString() ?? null,
    canEdit,
  };
}

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
    paidAt: s.paidAt?.toISOString() ?? null,
    paidByName: s.paidBy?.name ?? null,
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
