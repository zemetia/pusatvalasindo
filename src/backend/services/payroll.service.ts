import prisma from "@/lib/prisma";
import { kpiService } from "./kpi.service";
import { salaryComponentService } from "./salary-component.service";
import { NotFoundError, ForbiddenError } from "@/backend/errors/app-error";
import type { KpiBreakdown } from "@/lib/kpi-utils";
import { allows, allowsCompany, type AuthzSubject } from "@/lib/authz/resolve";
import {
  evaluateRulesForEmployee,
  loadEmployeeContext,
} from "@/backend/payroll-rules/engine";

/**
 * Boleh melihat gaji seorang karyawan? Predikat, bukan guard — supaya halaman
 * bisa menyembunyikan bagian gaji tanpa menangkap exception, dengan aturan yang
 * tetap tinggal di satu tempat.
 *
 * Dua jalur, sesuai matriks izin:
 *   • `payroll.manage` di PT karyawan itu — wewenang mengelola gaji orang lain,
 *     di-scope per PT.
 *   • `payroll.self` — gaji sendiri.
 *
 * Daftar `custom_role.payrollCompanyIds` yang lama tidak dipakai lagi: scope
 * per-PT sekarang berasal dari matriks izin, bukan kolom terpisah.
 */
export function canViewPayrollOf(
  subject: AuthzSubject,
  callerId: string,
  targetUserId: string,
  targetCompanyId: string | null
): boolean {
  if (allowsCompany(subject, "payroll.manage", "view", targetCompanyId)) return true;
  return callerId === targetUserId && allows(subject, "payroll.self", "view");
}

/** Versi guard dari `canViewPayrollOf` — dipakai route & service. */
export function assertPayrollAccess(
  subject: AuthzSubject,
  callerId: string,
  targetUserId: string,
  targetCompanyId: string | null
) {
  if (canViewPayrollOf(subject, callerId, targetUserId, targetCompanyId)) return;

  // Pesan dibedakan supaya admin PT tahu bahwa masalahnya PT-nya, bukan
  // haknya atas modul gaji secara keseluruhan.
  if (allows(subject, "payroll.manage", "view")) {
    throw new ForbiddenError("Tidak punya akses ke gaji PT ini");
  }
  throw new ForbiddenError("Tidak punya akses ke data gaji ini");
}

export const payrollService = {
  calculateMonthlyPayroll: async (
    employeeId: string,
    month: number,
    year: number
  ) => {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);

    // employee, KPI result, attendances, and salary components only depend on
    // employeeId/date range, not on each other — fetch them concurrently
    // instead of round-tripping serially
    const [employee, kpiResult, attendances, extraComponents, employeeCtx] = await Promise.all([
      prisma.user.findUnique({
        where: { id: employeeId },
        select: {
          id: true,
          name: true,
          baseSalary: true,
          mealAllowance: true,
          transportAllowance: true,
          positionAllowance: true,
          bpjsKesehatan: true,
        },
      }),
      // KPI calculation also saves/updates the KpiMonthlyResult record
      kpiService.calculateMonthlyResult(employeeId, month, year),
      prisma.attendance.findMany({
        where: { userId: employeeId, date: { gte: startDate, lt: endDate } },
      }),
      salaryComponentService.listForUser(employeeId),
      loadEmployeeContext(employeeId),
    ]);

    if (!employee || !employeeCtx) throw new NotFoundError("Karyawan tidak ditemukan");

    const base = Number(employee.baseSalary ?? 0);
    const meal = Number(employee.mealAllowance ?? 0);
    const transport = Number(employee.transportAllowance ?? 0);
    const position = Number(employee.positionAllowance ?? 0);
    // BPJS di sini adalah alokasi perusahaan untuk karyawan, jadi MENAMBAH gaji
    // — bukan potongan iuran karyawan.
    const bpjs = Number(employee.bpjsKesehatan ?? 0);

    // Komponen tambahan (tunjangan pulsa, potongan koperasi, dst.). Semuanya
    // nominal tetap per bulan, sama seperti kolom tetap di atas. Komponen yang
    // induknya sudah dinonaktifkan tidak ikut dihitung, tapi nilainya tetap
    // tersimpan supaya aktif kembali tanpa harus diisi ulang.
    const activeComponents = extraComponents.filter((c) => c.isActive);
    const extraAllowances = activeComponents.filter((c) => c.kind === "ALLOWANCE");
    const extraDeductionItems = activeComponents.filter((c) => c.kind === "DEDUCTION");
    const totalExtraAllowance = extraAllowances.reduce((sum, c) => sum + c.amount, 0);
    const totalExtraDeduction = extraDeductionItems.reduce((sum, c) => sum + c.amount, 0);

    // Tunjangan tambahan ikut masuk gaji kotor, jadi ikut mengangkat `dailyRate`
    // — potongan absen/izin memang dihitung dari gaji kotor per hari, bukan dari
    // gaji pokok saja. Potongan komponen TIDAK ikut, ia langsung mengurangi THP.
    const totalGrossFixed =
      base + meal + transport + position + bpjs + totalExtraAllowance;
    const dailyRate = totalGrossFixed / 24;

    // Potongan keterlambatan TIDAK lagi dihitung di sini — ia sekarang menjadi
    // rule `denda_keterlambatan` di tabel PayrollRule, dengan angka yang
    // sama persis. Kalau suatu saat blok itu dihidupkan kembali di sini,
    // karyawan akan dipotong dua kali.
    let totalAbsenceDeduction = 0;

    for (const att of attendances) {
      if (att.status === "SICK") {
        totalAbsenceDeduction += dailyRate;
      } else if (att.status === "PERMISSION") {
        // Tanpa surat dokter = potong 2 hari; dengan surat = 1 hari
        totalAbsenceDeduction += att.isWithDoctorNote ? dailyRate : dailyRate * 2;
      } else if (att.status === "ABSENT") {
        totalAbsenceDeduction += dailyRate * 2;
      }
    }

    // Reward & punishment dari rule engine (prisma/seeds/payroll-rules/). Dijalankan
    // setelah KPI tersimpan karena rule boleh membandingkan karyawan dengan
    // rekan sejawatnya lewat KpiMonthlyResult.
    const rules = await evaluateRulesForEmployee(employeeCtx, month, year);

    const totalDeductions = totalAbsenceDeduction + totalExtraDeduction;
    const takeHomePay =
      totalGrossFixed - totalDeductions + rules.netAmount;

    return {
      employee: {
        id: employee.id,
        name: employee.name,
      },
      period: { month, year },
      components: {
        baseSalary: base,
        mealAllowance: meal,
        transportAllowance: transport,
        positionAllowance: position,
        bpjsKesehatan: bpjs,
        // `componentId` ikut dibawa keluar supaya entri slip bisa menunjuk
        // balik ke komponen gajinya (PayrollSlipEntry.salaryComponentId).
        extraAllowances: extraAllowances.map((c) => ({
          componentId: c.componentId,
          name: c.name,
          amount: c.amount,
        })),
        totalExtraAllowance,
        totalGrossFixed,
        dailyRate,
      },
      kpi: {
        score: Number(kpiResult.totalScore),
        grade: kpiResult.grade,
        breakdownJson: kpiResult.breakdownJson as unknown as KpiBreakdown,
        calculatedAt: kpiResult.calculatedAt.toISOString(),
      },
      rules: {
        entries: rules.entries,
        totalBonus: rules.totalBonus,
        totalPenalty: rules.totalPenalty,
        netAmount: rules.netAmount,
        needsReview: rules.needsReview,
        mandatorySaturday: rules.mandatorySaturday,
        warningLetter: rules.warningLetter,
        rulesetVersions: rules.rulesetVersions,
        // Gabungan tanda tangan seluruh rule yang dimuat. Disimpan di
        // PayrollRun supaya dua run dengan angka berbeda bisa dibedakan antara
        // "datanya berubah" dan "rule-nya berubah".
        rulesetHash: rules.rulesetHash,
      },
      deductions: {
        absence: totalAbsenceDeduction,
        components: extraDeductionItems.map((c) => ({
          componentId: c.componentId,
          name: c.name,
          amount: c.amount,
        })),
        totalComponents: totalExtraDeduction,
        total: totalDeductions,
      },
      final: {
        takeHomePay,
      },
      attendanceDetail: {
        totalDaysLogged: attendances.length,
      },
    };
  },
};
