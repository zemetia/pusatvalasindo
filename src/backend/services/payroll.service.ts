import prisma from "@/lib/prisma";
import { kpiService } from "./kpi.service";
import { salaryComponentService, pickCoreAllowances, isCoreAllowance } from "./salary-component.service";
import { NotFoundError, ForbiddenError } from "@/backend/errors/app-error";
import type { KpiBreakdown } from "@/lib/kpi-utils";
import { jakartaDateIso } from "@/lib/attendance-time";
import { WORK_DAYS_PER_MONTH, deriveAlphaDays } from "@/lib/workday";
import { computeAbsenceDeduction } from "./absence-deduction";
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
    const [employee, kpiResult, attendances, extraComponents, employeeCtx, holidayRows] =
      await Promise.all([
      prisma.user.findUnique({
        where: { id: employeeId },
        select: {
          id: true,
          name: true,
          baseSalary: true,
          // Batas awal hari yang boleh dinilai alpha — sebelum karyawan
          // bergabung, hari kosong bukan bolos.
          joinDate: true,
        },
      }),
      // KPI calculation also saves/updates the KpiMonthlyResult record
      kpiService.calculateMonthlyResult(employeeId, month, year),
      prisma.attendance.findMany({
        where: { userId: employeeId, date: { gte: startDate, lt: endDate } },
      }),
      salaryComponentService.listForUser(employeeId),
      loadEmployeeContext(employeeId),
      // Tanggal merah periode ini. Tanpa daftar ini setiap hari libur nasional
      // yang lewat tanpa presensi akan terbaca alpha dan dipotong.
      prisma.publicHoliday.findMany({
        where: { date: { gte: startDate, lt: endDate } },
        select: { date: true },
      }),
    ]);

    if (!employee || !employeeCtx) throw new NotFoundError("Karyawan tidak ditemukan");

    const base = Number(employee.baseSalary ?? 0);
    // Uang makan/transport/jabatan/BPJS tidak lagi kolom tetap di `user` —
    // sekarang 4 SalaryComponent global biasa, dicocokkan lewat nama (lihat
    // CORE_ALLOWANCE_NAMES). BPJS di sini adalah alokasi perusahaan untuk
    // karyawan, jadi MENAMBAH gaji — bukan potongan iuran karyawan.
    const { meal, transport, position, bpjs } = pickCoreAllowances(extraComponents);

    // Komponen tambahan (tunjangan pulsa, potongan koperasi, dst.), TIDAK
    // termasuk 4 komponen inti di atas — sudah dihitung tersendiri supaya
    // tidak dobel. Semuanya nominal tetap per bulan. Komponen yang induknya
    // sudah dinonaktifkan tidak ikut dihitung, tapi nilainya tetap tersimpan
    // supaya aktif kembali tanpa harus diisi ulang.
    const activeComponents = extraComponents.filter((c) => c.isActive && !isCoreAllowance(c.name));
    const extraAllowances = activeComponents.filter((c) => c.kind === "ALLOWANCE");
    const extraDeductionItems = activeComponents.filter((c) => c.kind === "DEDUCTION");
    const totalExtraAllowance = extraAllowances.reduce((sum, c) => sum + c.amount, 0);
    const totalExtraDeduction = extraDeductionItems.reduce((sum, c) => sum + c.amount, 0);

    // Tunjangan tambahan ikut masuk gaji kotor, jadi ikut mengangkat `dailyRate`
    // — potongan absen/izin memang dihitung dari gaji kotor per hari, bukan dari
    // gaji pokok saja. Potongan komponen TIDAK ikut, ia langsung mengurangi THP.
    const totalGrossFixed =
      base + meal + transport + position + bpjs + totalExtraAllowance;
    const dailyRate = totalGrossFixed / WORK_DAYS_PER_MONTH;

    // Uang makan & transport per hari — pengganti biaya harian, bukan hak yang
    // berjalan saat orangnya tidak datang. Inilah yang dipotong pada hari CUTI:
    // cutinya sendiri berbayar (gaji pokok utuh), yang hilang cuma ongkos
    // harian yang memang tidak dikeluarkan.
    const dailyFieldAllowance = (meal + transport) / WORK_DAYS_PER_MONTH;

    // ── Alpha yang tidak punya baris presensi sama sekali ──────────────────
    //
    // Sampai sebelum ini, hanya baris ber-status ABSENT yang dipotong — padahal
    // baris presensi cuma lahir kalau karyawan absen sendiri atau HR mengisi
    // hari itu. Artinya orang yang tidak masuk DAN tidak mengabari siapa pun
    // tidak meninggalkan baris apa pun, jadi tidak terpotong sepeser pun,
    // sementara rekannya yang izin dengan sopan dipotong. Hari kerja yang lewat
    // tanpa baris kini dihitung alpha dengan tarif yang sama persis dengan
    // ABSENT yang dicatat HR — sumber datanya beda, aturannya satu.
    const alphaDates = deriveAlphaDays({
      year,
      month,
      recordedDates: new Set(attendances.map((a) => a.date.toISOString().slice(0, 10))),
      holidays: new Set(holidayRows.map((h) => h.date.toISOString().slice(0, 10))),
      todayIso: jakartaDateIso(),
      joinIso: employee.joinDate?.toISOString().slice(0, 10) ?? null,
    });

    // Tarif tiap kategori tinggal di absence-deduction.ts — lihat tabel
    // kebijakannya di sana. Keterlambatan tidak ikut: itu rule tersendiri.
    const { total: totalAbsenceDeduction, days: absenceDays } = computeAbsenceDeduction({
      records: attendances,
      alphaWithoutRecord: alphaDates.length,
      dailyRate,
      dailyFieldAllowance,
    });

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
        /** Hari kerja lewat tanpa baris presensi — alpha yang tidak tercatat. */
        alphaWithoutRecord: alphaDates.length,
        alphaDates,
        recordedAbsentDays: absenceDays.alphaTercatat,
        /** Jumlah hari per kategori potongan, supaya slip bisa merincinya. */
        absenceDays,
        dailyRate,
        dailyFieldAllowance,
      },
    };
  },
};
