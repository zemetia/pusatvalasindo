// ═══════════════════════════════════════════════════════════════════════════
// PAYROLL RUN — menghitung gaji satu PT untuk satu bulan, lalu MENYIMPANNYA.
//
// Sebelumnya `payrollService.calculateMonthlyPayroll` hanya mengembalikan
// angka ke pemanggil dan tidak menulis apa pun. Akibatnya seluruh yang
// dirancang payroll-run.prisma tidak pernah terjadi: `inputs` per entri tidak
// tersimpan, entri SKIPPED/ERROR tidak tersimpan, dan tidak ada apa pun untuk
// ditunjukkan saat gaji disengketakan. Service inilah yang menutup lubang itu.
//
// Tiga hal yang menentukan bentuknya, semuanya mengikuti payroll-run.prisma:
//
//   1. GENERATE ULANG TIDAK MENIMPA. Setiap perhitungan membuat run baru
//      dengan `attempt` berikutnya; run sebelumnya yang belum dibayar ditandai
//      VOID, bukan dihapus. Run yang SUDAH DIBAYAR tidak pernah disentuh.
//   2. SETIAP ANGKA PUNYA BARIS. Bonus, denda, tunjangan, potongan komponen,
//      dan potongan ketidakhadiran semuanya menjadi PayrollSlipEntry beserta
//      `inputs`-nya — termasuk rule yang TIDAK menghasilkan uang (SKIPPED /
//      ERROR), supaya slip bisa menjelaskan kenapa sesuatu tidak keluar.
//   3. SNAPSHOT. Nominal di slip adalah keadaan saat run dibuat. Gaji pokok
//      yang naik bulan depan tidak mengubah slip bulan ini.
// ═══════════════════════════════════════════════════════════════════════════

import prisma from "@/lib/prisma";
import { NotFoundError, ValidationError } from "@/backend/errors/app-error";
import { payrollService } from "./payroll.service";
import type { Prisma } from "@src/generated/prisma/client";

type EntrySource = "RULE" | "COMPONENT" | "SISTEM" | "MANUAL";
type EntryType = "BONUS" | "DENDA" | "POTONGAN" | "TUNJANGAN";
type EntryStatus = "APPLIED" | "SKIPPED" | "ERROR";

type EntryDraft = {
  source: EntrySource;
  type: EntryType;
  status: EntryStatus;
  ruleId?: string | null;
  ruleVersion?: number | null;
  salaryComponentId?: string | null;
  tier?: string | null;
  label: string;
  amount: number;
  inputs?: Prisma.InputJsonValue;
  breakdown?: Prisma.InputJsonValue;
  formula?: string | null;
  flag?: string | null;
};

/**
 * Periode gaji = bulan kalender penuh.
 *
 * `PayrollRun` sengaja menyimpan rentang tanggal, bukan sekadar bulan, supaya
 * periode gaji yang tidak mengikuti kalender (mis. 26–25) bisa diwakili nanti
 * tanpa migrasi. Untuk sekarang hanya ada satu bentuk, dan ia ditentukan di
 * sini — bukan di tiga tempat berbeda.
 */
export function periodRange(month: number, year: number) {
  return {
    periodStart: new Date(Date.UTC(year, month - 1, 1)),
    // Hari terakhir bulan itu, bukan hari pertama bulan berikutnya: kolomnya
    // `@db.Date` dan rentangnya inklusif di kedua ujung.
    periodEnd: new Date(Date.UTC(year, month, 0)),
  };
}

/** Tipe entri untuk hasil rule. `tipe` rule yang menentukan pos di slip. */
function entryTypeOfRule(tipe: string): EntryType {
  if (tipe === "bonus") return "BONUS";
  if (tipe === "denda") return "DENDA";
  return "POTONGAN";
}

/**
 * Susun seluruh baris slip seorang karyawan dari hasil perhitungan.
 *
 * Dipisah dari penulisan database supaya bisa diuji tanpa Prisma, dan supaya
 * jelas bahwa TIDAK ADA angka yang lahir di sini — semuanya berasal dari
 * `calculateMonthlyPayroll`.
 */
export function buildSlipEntries(
  calc: Awaited<ReturnType<typeof payrollService.calculateMonthlyPayroll>>
): EntryDraft[] {
  const entries: EntryDraft[] = [];

  // ── Tunjangan tambahan ──────────────────────────────────────────────────
  for (const c of calc.components.extraAllowances) {
    entries.push({
      source: "COMPONENT",
      type: "TUNJANGAN",
      status: "APPLIED",
      salaryComponentId: c.componentId,
      label: c.name,
      amount: c.amount,
      inputs: { nominal: c.amount },
    });
  }

  // ── Potongan komponen ───────────────────────────────────────────────────
  for (const c of calc.deductions.components) {
    entries.push({
      source: "COMPONENT",
      type: "POTONGAN",
      status: "APPLIED",
      salaryComponentId: c.componentId,
      label: c.name,
      // Pengurang selalu ditandatangani negatif; ringkasan di slip yang
      // menormalkannya kembali.
      amount: -Math.abs(c.amount),
      inputs: { nominal: c.amount },
    });
  }

  // ── Potongan ketidakhadiran ─────────────────────────────────────────────
  // Belum menjadi rule (tidak seperti denda keterlambatan), jadi sumbernya
  // SISTEM. Tetap dibuatkan baris supaya slip tidak memuat angka yang tak bisa
  // dijelaskan.
  if (calc.deductions.absence > 0) {
    entries.push({
      source: "SISTEM",
      type: "POTONGAN",
      status: "APPLIED",
      label: "Potongan ketidakhadiran (sakit / izin / alpha)",
      amount: -Math.abs(calc.deductions.absence),
      inputs: {
        gaji_harian: calc.components.dailyRate,
        hari_presensi_tercatat: calc.attendanceDetail.totalDaysLogged,
      },
    });
  }

  // ── Hasil rule engine ───────────────────────────────────────────────────
  // Entri berstatus SKIPPED/ERROR ikut disimpan — itulah satu-satunya cara
  // slip bisa menjawab "kenapa bonus saya tidak keluar bulan ini".
  for (const e of calc.rules.entries) {
    entries.push({
      source: "RULE",
      type: entryTypeOfRule(e.tipe),
      status: e.status,
      ruleId: e.ruleId,
      ruleVersion: e.ruleVersion,
      tier: e.tier,
      label: e.label,
      amount: e.amount,
      inputs: e.inputs as Prisma.InputJsonValue,
      breakdown: (e.breakdown ?? undefined) as Prisma.InputJsonValue | undefined,
      formula: e.formula,
      flag: e.flag,
    });
  }

  return entries;
}

/** Bentuk minimal sebuah entri yang dibutuhkan untuk menjumlahkan totalnya. */
type EntryLike = { type: EntryType; status: EntryStatus; amount: number; flag?: string | null };

/**
 * Jumlahkan total per tipe dari sekumpulan entri — dipakai baik saat menyusun
 * slip baru (`summarize`) maupun saat menambah/menghapus entri MANUAL di slip
 * yang sudah ada, supaya kedua jalur itu tidak punya rumus penjumlahan yang
 * bisa menyimpang satu sama lain.
 */
export function computeTotals(entries: EntryLike[]) {
  const sum = (pred: (e: EntryLike) => boolean) =>
    entries.filter((e) => e.status === "APPLIED" && pred(e)).reduce((s, e) => s + e.amount, 0);

  return {
    totalBonus: sum((e) => e.type === "BONUS"),
    totalPenalty: Math.abs(sum((e) => e.type === "DENDA")),
    totalDeduction: Math.abs(sum((e) => e.type === "POTONGAN")),
    totalAllowance: sum((e) => e.type === "TUNJANGAN"),
    needsReview: entries.some((e) => e.status !== "APPLIED" || e.flag != null),
  };
}

/** Bentuk `entries.create` Prisma dari draft — dipakai di setiap tempat yang menulis PayrollSlipEntry. */
function toEntryCreateInputs(entries: EntryDraft[]) {
  return entries.map((e) => ({
    source: e.source,
    type: e.type,
    status: e.status,
    ruleId: e.ruleId ?? null,
    ruleVersion: e.ruleVersion ?? null,
    salaryComponentId: e.salaryComponentId ?? null,
    tier: e.tier ?? null,
    label: e.label,
    amount: e.amount,
    inputs: e.inputs,
    breakdown: e.breakdown,
    formula: e.formula ?? null,
    flag: e.flag ?? null,
  }));
}

/**
 * Gabungkan ringkasan hasil rule engine terbaru dengan entri MANUAL yang
 * dipertahankan dari slip sebelumnya. Dipakai `recalculateSlip` dan
 * `generateOrUpdateSlipFor` — keduanya menulis ulang entri RULE/COMPONENT/
 * SISTEM tapi tidak pernah menghapus entri MANUAL, jadi totalnya harus
 * mencerminkan gabungan keduanya, bukan cuma hasil rule terbaru.
 */
function mergeWithManual(baseSummary: ReturnType<typeof summarize>, manualEntries: EntryLike[]) {
  const manualTotals = computeTotals(manualEntries);
  const totalBonus = baseSummary.totalBonus + manualTotals.totalBonus;
  const totalDeduction = baseSummary.totalDeduction + manualTotals.totalDeduction;
  const totalPenalty = baseSummary.totalPenalty + manualTotals.totalPenalty;
  const netPay = baseSummary.grossPay - totalDeduction - totalPenalty + totalBonus;

  return {
    ...baseSummary,
    totalBonus,
    totalDeduction,
    totalPenalty,
    netPay,
    needsReview: baseSummary.needsReview || manualTotals.needsReview,
  };
}

/**
 * Gross/net dari komponen tetap yang sudah tersimpan di slip + total entri
 * terkini. Dipakai `addManualEntry`/`removeManualEntry`, yang mengubah entri
 * di slip yang SUDAH ADA tanpa menghitung ulang komponen tetapnya (itu urusan
 * `recalculateSlip`/`generateOrUpdateSlipFor`, bukan operasi ini).
 */
function recomputeFromFixed(
  fixed: {
    baseSalary: unknown;
    mealAllowance: unknown;
    transportAllowance: unknown;
    positionAllowance: unknown;
    bpjsKesehatan: unknown;
  },
  totals: ReturnType<typeof computeTotals>
) {
  const grossPay =
    Number(fixed.baseSalary) +
    Number(fixed.mealAllowance) +
    Number(fixed.transportAllowance) +
    Number(fixed.positionAllowance) +
    Number(fixed.bpjsKesehatan) +
    totals.totalAllowance;
  const netPay = grossPay - totals.totalDeduction - totals.totalPenalty + totals.totalBonus;
  return { grossPay, netPay };
}

/** Ringkasan slip, diturunkan dari entri — bukan diketik ulang. */
export function summarize(
  calc: Awaited<ReturnType<typeof payrollService.calculateMonthlyPayroll>>,
  entries: EntryDraft[]
) {
  const totals = computeTotals(entries);

  const c = calc.components;
  // Gaji kotor = komponen tetap + tunjangan tambahan. `totalGrossFixed` dari
  // perhitungan sudah memuat keduanya; dihitung ulang di sini akan menggandakan
  // tunjangan, jadi dipakai apa adanya.
  const grossPay = c.totalGrossFixed;
  const netPay = grossPay - totals.totalDeduction - totals.totalPenalty + totals.totalBonus;

  return {
    baseSalary: c.baseSalary,
    mealAllowance: c.mealAllowance,
    transportAllowance: c.transportAllowance,
    positionAllowance: c.positionAllowance,
    bpjsKesehatan: c.bpjsKesehatan,
    ...totals,
    grossPay,
    netPay,
  };
}

export const payrollRunService = {
  /**
   * Run terbaru yang masih berlaku untuk satu PT pada satu periode.
   *
   * Run VOID sengaja tidak ikut: ia sudah digantikan run yang lebih baru dan
   * hanya relevan saat menelusuri riwayat.
   */
  getRun: async (companyId: string, month: number, year: number) => {
    return prisma.payrollRun.findFirst({
      where: { companyId, periodMonth: month, periodYear: year, status: { not: "VOID" } },
      orderBy: { attempt: "desc" },
      include: {
        slips: {
          orderBy: { user: { name: "asc" } },
          include: {
            user: { select: { id: true, name: true } },
            branch: { select: { name: true } },
            customRole: { select: { name: true } },
            paidBy: { select: { name: true } },
            entries: { orderBy: { id: "asc" } },
          },
        },
      },
    });
  },

  /** Riwayat seluruh run satu PT pada satu periode, termasuk yang VOID. */
  listAttempts: async (companyId: string, month: number, year: number) => {
    return prisma.payrollRun.findMany({
      where: { companyId, periodMonth: month, periodYear: year },
      orderBy: { attempt: "desc" },
      select: {
        id: true,
        attempt: true,
        status: true,
        generatedAt: true,
        paidAt: true,
        _count: { select: { slips: true } },
      },
    });
  },

  /**
   * Hitung gaji seluruh karyawan aktif satu PT untuk satu bulan, lalu simpan.
   *
   * Perhitungan tiap karyawan dilakukan DI LUAR transaksi: ia memanggil KPI
   * service (yang menulis KpiMonthlyResult) dan menjalankan query rule lewat
   * koneksi read-only. Menahan semua itu di dalam satu transaksi berarti
   * menahan kunci database selama seluruh perusahaan dihitung. Yang masuk
   * transaksi hanya penulisan runnya.
   */
  generateRun: async (params: {
    companyId: string;
    month: number;
    year: number;
    generatedById: string | null;
  }) => {
    const { companyId, month, year, generatedById } = params;

    if (month < 1 || month > 12) throw new ValidationError("Bulan harus 1–12");

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    });
    if (!company) throw new NotFoundError("PT tidak ditemukan");

    // Sudah dibayar = sudah final. Angkanya tinggal dibaca dari slip yang
    // tersimpan, tidak perlu — dan tidak boleh — dihitung ulang: menghitung
    // ulang memanggil KPI service, yang menulis ulang KpiMonthlyResult bulan
    // itu dari data terkini. Dasar gaji yang sudah dibayar akan bergeser di
    // belakang layar.
    //
    // Ini juga berlaku kalau BARU SEBAGIAN karyawan dibayar (lewat "Bayar" per
    // orang): generate ulang men-VOID run yang sedang berjalan dan membuat run
    // baru, yang akan membuat slip karyawan yang sudah dibayar itu tidak lagi
    // muncul di run aktif — riwayat pembayarannya jadi tidak terlacak dari
    // halaman ini. Jadi begitu ada satu slip saja yang paidAt-nya terisi,
    // periode itu dikunci sama seperti run yang berstatus PAID.
    const runAktif = await prisma.payrollRun.findFirst({
      where: { companyId, periodYear: year, periodMonth: month, status: { not: "VOID" } },
      select: {
        status: true,
        slips: { where: { paidAt: { not: null } }, select: { id: true }, take: 1 },
      },
    });
    if (runAktif && (runAktif.status === "PAID" || runAktif.slips.length > 0)) {
      throw new ValidationError(
        "Gaji periode ini sudah ada yang dibayar dan tidak bisa dihitung ulang seluruhnya. " +
          "Angkanya tersimpan lengkap beserta alasannya di slip."
      );
    }

    const employees = await prisma.user.findMany({
      where: {
        isActive: true,
        customRoleId: { not: null },
        branch: { companyId },
      },
      select: { id: true, branchId: true, customRoleId: true },
      orderBy: { name: "asc" },
    });

    if (employees.length === 0) {
      throw new ValidationError("Tidak ada karyawan aktif di PT ini");
    }

    // Perhitungan berat, di luar transaksi.
    type Calculated = {
      emp: (typeof employees)[number];
      calc: Awaited<ReturnType<typeof payrollService.calculateMonthlyPayroll>>;
      entries: EntryDraft[];
      summary: ReturnType<typeof summarize>;
    };
    const calculated: Calculated[] = [];
    for (const emp of employees) {
      const calc = await payrollService.calculateMonthlyPayroll(emp.id, month, year);
      const entries = buildSlipEntries(calc);
      calculated.push({ emp, calc, entries, summary: summarize(calc, entries) });
    }

    const { periodStart, periodEnd } = periodRange(month, year);

    // `rulesetVersions` sama untuk seluruh karyawan dalam satu run — diambil
    // dari karyawan pertama. Kalau suatu saat rule berubah di tengah run, itu
    // justru harus terlihat sebagai run yang berbeda, bukan diratakan.
    const rulesetVersions = calculated[0]?.calc.rules.rulesetVersions ?? [];

    return prisma.$transaction(async (tx) => {
      const previous = await tx.payrollRun.findFirst({
        where: { companyId, periodYear: year, periodMonth: month },
        orderBy: { attempt: "desc" },
        select: { attempt: true },
      });
      const attempt = (previous?.attempt ?? 0) + 1;

      // Run lama yang belum dibayar digantikan. Yang sudah PAID dibiarkan utuh
      // — slip yang sudah dibayar harus tetap bisa ditunjukkan apa adanya.
      await tx.payrollRun.updateMany({
        where: {
          companyId,
          periodYear: year,
          periodMonth: month,
          status: { in: ["DRAFT", "FINALIZED"] },
        },
        data: { status: "VOID" },
      });

      const run = await tx.payrollRun.create({
        data: {
          companyId,
          periodStart,
          periodEnd,
          periodMonth: month,
          periodYear: year,
          attempt,
          status: "DRAFT",
          rulesetHash: calculated[0]?.calc.rules.rulesetHash ?? null,
          rulesetVersion: rulesetVersions as unknown as Prisma.InputJsonValue,
          generatedById,
        },
      });

      for (const { emp, entries, summary } of calculated) {
        await tx.payrollSlip.create({
          data: {
            runId: run.id,
            userId: emp.id,
            branchId: emp.branchId,
            customRoleId: emp.customRoleId,
            baseSalary: summary.baseSalary,
            mealAllowance: summary.mealAllowance,
            transportAllowance: summary.transportAllowance,
            positionAllowance: summary.positionAllowance,
            bpjsKesehatan: summary.bpjsKesehatan,
            totalBonus: summary.totalBonus,
            totalPenalty: summary.totalPenalty,
            totalDeduction: summary.totalDeduction,
            totalAllowance: summary.totalAllowance,
            grossPay: summary.grossPay,
            netPay: summary.netPay,
            needsReview: summary.needsReview,
            entries: { create: toEntryCreateInputs(entries) },
          },
        });
      }

      return run;
    });
  },

  /**
   * Hitung & simpan gaji SATU karyawan untuk satu bulan, tanpa menunggu
   * seluruh PT-nya di-generate lewat `generateRun`.
   *
   * Inilah yang membuat "Hitung" di kalkulator cepat pada halaman Payroll
   * benar-benar menghasilkan slip tersimpan (dengan rincian, kehadiran, dan
   * penyesuaian manual) untuk SATU orang — sebelumnya slip hanya ada kalau
   * seluruh PT sudah pernah dihitung sekaligus.
   *
   * - Belum ada run untuk PT+periode ini → run baru dibuat (attempt
   *   berikutnya), berisi slip karyawan ini saja. Karyawan lain di PT yang
   *   sama tetap belum punya slip sampai digenerate sendiri-sendiri atau
   *   lewat `generateRun` untuk seluruh PT.
   * - Sudah ada run yang masih berjalan (DRAFT/FINALIZED, belum ada yang
   *   dibayar) → dipakai ulang; slip karyawan ini ditambah kalau belum ada,
   *   atau dihitung ulang kalau sudah ada — dengan entri MANUAL yang sudah
   *   tercatat tetap dipertahankan, sama seperti `recalculateSlip`.
   * - Sudah ada yang dibayar di periode itu → ditolak, sama seperti
   *   `generateRun`.
   */
  generateOrUpdateSlipFor: async (params: {
    userId: string;
    month: number;
    year: number;
    generatedById: string | null;
  }) => {
    const { userId, month, year, generatedById } = params;
    if (month < 1 || month > 12) throw new ValidationError("Bulan harus 1–12");

    const employee = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, branchId: true, customRoleId: true, branch: { select: { companyId: true } } },
    });
    if (!employee?.branch?.companyId) {
      throw new ValidationError("Karyawan ini belum punya cabang/PT — gaji tidak bisa dihitung");
    }
    const companyId = employee.branch.companyId;

    const runAktif = await prisma.payrollRun.findFirst({
      where: { companyId, periodYear: year, periodMonth: month, status: { not: "VOID" } },
      select: {
        id: true,
        status: true,
        slips: { where: { paidAt: { not: null } }, select: { id: true }, take: 1 },
      },
    });
    if (runAktif && (runAktif.status === "PAID" || runAktif.slips.length > 0)) {
      throw new ValidationError(
        "Gaji periode ini sudah ada yang dibayar dan tidak bisa dihitung ulang."
      );
    }

    const calc = await payrollService.calculateMonthlyPayroll(userId, month, year);
    const entries = buildSlipEntries(calc);
    const baseSummary = summarize(calc, entries);
    const { periodStart, periodEnd } = periodRange(month, year);

    return prisma.$transaction(async (tx) => {
      let runId = runAktif?.id;
      if (!runId) {
        const previous = await tx.payrollRun.findFirst({
          where: { companyId, periodYear: year, periodMonth: month },
          orderBy: { attempt: "desc" },
          select: { attempt: true },
        });
        const run = await tx.payrollRun.create({
          data: {
            companyId,
            periodStart,
            periodEnd,
            periodMonth: month,
            periodYear: year,
            attempt: (previous?.attempt ?? 0) + 1,
            status: "DRAFT",
            rulesetHash: calc.rules.rulesetHash ?? null,
            rulesetVersion: calc.rules.rulesetVersions as unknown as Prisma.InputJsonValue,
            generatedById,
          },
        });
        runId = run.id;
      }

      const existingSlip = await tx.payrollSlip.findUnique({
        where: { runId_userId: { runId, userId } },
        select: {
          id: true,
          paidAt: true,
          entries: { where: { source: "MANUAL" }, select: { type: true, status: true, amount: true, flag: true } },
        },
      });

      if (existingSlip) {
        if (existingSlip.paidAt) {
          throw new ValidationError("Slip ini sudah dibayar, tidak bisa dihitung ulang");
        }
        const summary = mergeWithManual(
          baseSummary,
          existingSlip.entries.map((e) => ({ ...e, amount: Number(e.amount) }))
        );
        await tx.payrollSlipEntry.deleteMany({
          where: { slipId: existingSlip.id, source: { not: "MANUAL" } },
        });
        await tx.payrollSlip.update({
          where: { id: existingSlip.id },
          data: {
            baseSalary: summary.baseSalary,
            mealAllowance: summary.mealAllowance,
            transportAllowance: summary.transportAllowance,
            positionAllowance: summary.positionAllowance,
            bpjsKesehatan: summary.bpjsKesehatan,
            totalBonus: summary.totalBonus,
            totalPenalty: summary.totalPenalty,
            totalDeduction: summary.totalDeduction,
            totalAllowance: summary.totalAllowance,
            grossPay: summary.grossPay,
            netPay: summary.netPay,
            needsReview: summary.needsReview,
            entries: { create: toEntryCreateInputs(entries) },
          },
        });
        return existingSlip.id;
      }

      const created = await tx.payrollSlip.create({
        data: {
          runId,
          userId,
          branchId: employee.branchId,
          customRoleId: employee.customRoleId,
          baseSalary: baseSummary.baseSalary,
          mealAllowance: baseSummary.mealAllowance,
          transportAllowance: baseSummary.transportAllowance,
          positionAllowance: baseSummary.positionAllowance,
          bpjsKesehatan: baseSummary.bpjsKesehatan,
          totalBonus: baseSummary.totalBonus,
          totalPenalty: baseSummary.totalPenalty,
          totalDeduction: baseSummary.totalDeduction,
          totalAllowance: baseSummary.totalAllowance,
          grossPay: baseSummary.grossPay,
          netPay: baseSummary.netPay,
          needsReview: baseSummary.needsReview,
          entries: { create: toEntryCreateInputs(entries) },
        },
      });
      return created.id;
    });
  },

  /**
   * Tandai run sudah dibayar — SEMUA slip yang belum dibayar ikut ditandai.
   *
   * `finalizedAt` ikut diisi kalau belum: alur di halaman payroll hanya punya
   * satu tombol (Bayar), tapi kolom itu tetap harus terisi supaya riwayatnya
   * lengkap. Setelah PAID, isi run tidak boleh berubah lagi — generate ulang
   * membuat run baru dan tidak menyentuh yang ini.
   *
   * Slip yang sudah dibayar duluan (lewat "Bayar" per orang) TIDAK ditimpa
   * `paidAt`/`paidById`-nya — orang yang membayarkannya tetap tercatat siapa
   * apa adanya.
   */
  markPaid: async (runId: string, userId: string | null) => {
    const run = await prisma.payrollRun.findUnique({
      where: { id: runId },
      select: { id: true, status: true, finalizedAt: true },
    });
    if (!run) throw new NotFoundError("Run payroll tidak ditemukan");
    if (run.status === "PAID") throw new ValidationError("Run ini sudah dibayar");
    if (run.status === "VOID") {
      throw new ValidationError("Run ini sudah digantikan perhitungan yang lebih baru");
    }

    const now = new Date();
    return prisma.$transaction(async (tx) => {
      await tx.payrollSlip.updateMany({
        where: { runId, paidAt: null },
        data: { paidAt: now, paidById: userId },
      });

      return tx.payrollRun.update({
        where: { id: runId },
        data: {
          status: "PAID",
          paidAt: now,
          finalizedAt: run.finalizedAt ?? now,
          finalizedById: run.finalizedAt ? undefined : userId,
        },
      });
    });
  },

  /**
   * Tandai SATU slip sudah dibayar, tanpa menunggu rekan sejawatnya.
   *
   * Kalau ini slip terakhir yang belum dibayar di runnya, run ikut ditandai
   * PAID — supaya statusnya selalu konsisten dengan slip-slip di dalamnya,
   * dan supaya guard di `generateRun` (yang mengunci run berstatus PAID)
   * tetap berlaku begitu semua orang sudah menerima gajinya.
   */
  markSlipPaid: async (slipId: string, userId: string | null) => {
    const slip = await prisma.payrollSlip.findUnique({
      where: { id: slipId },
      select: { id: true, runId: true, paidAt: true, run: { select: { status: true, finalizedAt: true } } },
    });
    if (!slip) throw new NotFoundError("Slip gaji tidak ditemukan");
    if (slip.run.status === "VOID") {
      throw new ValidationError("Run ini sudah digantikan perhitungan yang lebih baru");
    }
    if (slip.paidAt) throw new ValidationError("Slip ini sudah dibayar");

    const now = new Date();
    return prisma.$transaction(async (tx) => {
      const updatedSlip = await tx.payrollSlip.update({
        where: { id: slipId },
        data: { paidAt: now, paidById: userId },
      });

      const belumDibayar = await tx.payrollSlip.count({
        where: { runId: slip.runId, paidAt: null },
      });

      if (belumDibayar === 0) {
        await tx.payrollRun.update({
          where: { id: slip.runId },
          data: {
            status: "PAID",
            paidAt: now,
            finalizedAt: slip.run.finalizedAt ?? now,
            finalizedById: slip.run.finalizedAt ? undefined : userId,
          },
        });
      }

      return updatedSlip;
    });
  },

  /**
   * Hitung ulang SATU slip di dalam run yang sedang berjalan, tanpa menyentuh
   * slip karyawan lain dan tanpa membuat run/attempt baru.
   *
   * Beda dari `generateRun`: itu untuk seluruh PT (dan men-VOID run lama),
   * ini untuk satu orang saat datanya baru saja dikoreksi (mis. presensi
   * baru diperbaiki) dan HR ingin melihat dampaknya ke satu slip itu saja
   * sebelum membayar.
   *
   * Entri MANUAL (penyesuaian HR di luar rule engine) sengaja TIDAK ikut
   * dihapus — hanya entri RULE/COMPONENT/SISTEM yang disusun ulang dari hasil
   * perhitungan terbaru. Kalau ikut terhapus, mengoreksi satu rule akan diam-
   * diam menghapus bonus/potongan manual yang sudah dicatat HR beserta
   * alasannya.
   */
  recalculateSlip: async (slipId: string) => {
    const slip = await prisma.payrollSlip.findUnique({
      where: { id: slipId },
      select: {
        id: true,
        userId: true,
        runId: true,
        paidAt: true,
        run: { select: { status: true, periodMonth: true, periodYear: true } },
        entries: { where: { source: "MANUAL" }, select: { type: true, status: true, amount: true, flag: true } },
      },
    });
    if (!slip) throw new NotFoundError("Slip gaji tidak ditemukan");
    if (slip.paidAt) throw new ValidationError("Slip yang sudah dibayar tidak bisa dihitung ulang");
    if (slip.run.status === "PAID" || slip.run.status === "VOID") {
      throw new ValidationError("Run ini tidak bisa dihitung ulang lagi");
    }

    const calc = await payrollService.calculateMonthlyPayroll(
      slip.userId,
      slip.run.periodMonth,
      slip.run.periodYear
    );
    const entries = buildSlipEntries(calc);
    const baseSummary = summarize(calc, entries);
    const summary = mergeWithManual(
      baseSummary,
      slip.entries.map((e) => ({ ...e, amount: Number(e.amount) }))
    );

    await prisma.$transaction(async (tx) => {
      await tx.payrollSlipEntry.deleteMany({ where: { slipId, source: { not: "MANUAL" } } });
      await tx.payrollSlip.update({
        where: { id: slipId },
        data: {
          baseSalary: summary.baseSalary,
          mealAllowance: summary.mealAllowance,
          transportAllowance: summary.transportAllowance,
          positionAllowance: summary.positionAllowance,
          bpjsKesehatan: summary.bpjsKesehatan,
          totalBonus: summary.totalBonus,
          totalPenalty: summary.totalPenalty,
          totalDeduction: summary.totalDeduction,
          totalAllowance: summary.totalAllowance,
          grossPay: summary.grossPay,
          netPay: summary.netPay,
          needsReview: summary.needsReview,
          entries: { create: toEntryCreateInputs(entries) },
        },
      });
    });

    return slip.runId;
  },

  /**
   * Slip yang SUDAH tersimpan untuk satu karyawan pada satu periode, kalau
   * ada — dipakai kalkulator cepat di halaman Payroll supaya begitu periode
   * itu sudah pernah dihitung lewat Run, angkanya langsung tampil tanpa
   * pemakainya perlu menekan "Hitung" lagi. Run VOID sengaja tidak ikut,
   * sama seperti `getRun`: sudah digantikan run yang lebih baru.
   */
  findSlipDetailFor: async (userId: string, month: number, year: number) => {
    const slip = await prisma.payrollSlip.findFirst({
      where: { userId, run: { periodMonth: month, periodYear: year, status: { not: "VOID" } } },
      orderBy: { run: { attempt: "desc" } },
      select: { id: true },
    });
    if (!slip) return null;
    return payrollRunService.getSlipDetail(slip.id);
  },

  /** Slip satu karyawan beserta seluruh rincian, PT, dan periode runnya. */
  getSlipDetail: async (slipId: string) => {
    return prisma.payrollSlip.findUnique({
      where: { id: slipId },
      include: {
        user: { select: { id: true, name: true } },
        branch: { select: { name: true } },
        customRole: { select: { name: true } },
        paidBy: { select: { name: true } },
        entries: { orderBy: { id: "asc" } },
        run: {
          select: {
            id: true,
            companyId: true,
            periodMonth: true,
            periodYear: true,
            status: true,
            company: { select: { name: true } },
          },
        },
      },
    });
  },

  /**
   * Boleh diubah (entri manual ditambah/dihapus, atau dihitung ulang) selama
   * slip dan runnya belum dibayar/digantikan. Satu aturan, dipakai di dua
   * tempat (`addManualEntry`, `removeManualEntry`) supaya guard-nya tidak
   * bisa berbeda.
   */
  assertSlipEditable(slip: { paidAt: Date | null; run: { status: string } }) {
    if (slip.paidAt) throw new ValidationError("Slip yang sudah dibayar tidak bisa diubah");
    if (slip.run.status === "PAID" || slip.run.status === "VOID") {
      throw new ValidationError("Run ini sudah tidak bisa diubah");
    }
  },

  /**
   * Tambah SATU entri penyesuaian manual (bonus, denda, atau potongan/utang)
   * ke sebuah slip, di luar apa pun yang dihasilkan rule engine — mis. bonus
   * proyek khusus, denda kasus tertentu, atau potongan cicilan utang. `label`
   * adalah alasannya, dan wajib diisi: entri manual harus bisa menjelaskan
   * dirinya sendiri persis seperti entri rule.
   */
  addManualEntry: async (params: {
    slipId: string;
    type: "BONUS" | "DENDA" | "POTONGAN";
    label: string;
    amount: number;
  }) => {
    const { slipId, type, amount } = params;
    const label = params.label.trim();
    if (!label) throw new ValidationError("Alasan wajib diisi");
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new ValidationError("Nominal harus lebih dari 0");
    }

    const slip = await prisma.payrollSlip.findUnique({
      where: { id: slipId },
      select: {
        paidAt: true,
        baseSalary: true,
        mealAllowance: true,
        transportAllowance: true,
        positionAllowance: true,
        bpjsKesehatan: true,
        run: { select: { status: true } },
        entries: { select: { type: true, status: true, amount: true, flag: true } },
      },
    });
    if (!slip) throw new NotFoundError("Slip gaji tidak ditemukan");
    payrollRunService.assertSlipEditable(slip);

    // Bonus manual selalu menambah, pengurangan manual selalu mengurangi —
    // arahnya ditentukan oleh tipe yang dipilih, bukan oleh tanda nominal yang
    // diketik.
    const signedAmount = type === "BONUS" ? Math.abs(amount) : -Math.abs(amount);

    return prisma.$transaction(async (tx) => {
      const created = await tx.payrollSlipEntry.create({
        data: { slipId, source: "MANUAL", type, status: "APPLIED", label, amount: signedAmount },
      });

      const allEntries = [
        ...slip.entries.map((e) => ({ ...e, amount: Number(e.amount) })),
        { type, status: "APPLIED" as const, amount: signedAmount, flag: null },
      ];
      const totals = computeTotals(allEntries);
      const { grossPay, netPay } = recomputeFromFixed(slip, totals);

      await tx.payrollSlip.update({
        where: { id: slipId },
        data: {
          totalBonus: totals.totalBonus,
          totalPenalty: totals.totalPenalty,
          totalDeduction: totals.totalDeduction,
          totalAllowance: totals.totalAllowance,
          grossPay,
          netPay,
          needsReview: totals.needsReview,
        },
      });

      return created;
    });
  },

  /** Hapus satu entri manual. Entri dari rule engine tidak boleh dihapus lewat sini. */
  removeManualEntry: async (entryId: string) => {
    const entry = await prisma.payrollSlipEntry.findUnique({
      where: { id: entryId },
      select: {
        slipId: true,
        source: true,
        slip: {
          select: {
            paidAt: true,
            baseSalary: true,
            mealAllowance: true,
            transportAllowance: true,
            positionAllowance: true,
            bpjsKesehatan: true,
            run: { select: { status: true } },
          },
        },
      },
    });
    if (!entry) throw new NotFoundError("Entri tidak ditemukan");
    if (entry.source !== "MANUAL") {
      throw new ValidationError("Hanya penyesuaian manual yang bisa dihapus di sini");
    }
    payrollRunService.assertSlipEditable(entry.slip);

    const slipId = entry.slipId;
    return prisma.$transaction(async (tx) => {
      await tx.payrollSlipEntry.delete({ where: { id: entryId } });

      const remaining = await tx.payrollSlipEntry.findMany({
        where: { slipId },
        select: { type: true, status: true, amount: true, flag: true },
      });
      const totals = computeTotals(remaining.map((e) => ({ ...e, amount: Number(e.amount) })));
      const { grossPay, netPay } = recomputeFromFixed(entry.slip, totals);

      await tx.payrollSlip.update({
        where: { id: slipId },
        data: {
          totalBonus: totals.totalBonus,
          totalPenalty: totals.totalPenalty,
          totalDeduction: totals.totalDeduction,
          totalAllowance: totals.totalAllowance,
          grossPay,
          netPay,
          needsReview: totals.needsReview,
        },
      });

      return slipId;
    });
  },
};
