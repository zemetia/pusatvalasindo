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

/** Ringkasan slip, diturunkan dari entri — bukan diketik ulang. */
export function summarize(
  calc: Awaited<ReturnType<typeof payrollService.calculateMonthlyPayroll>>,
  entries: EntryDraft[]
) {
  const sum = (pred: (e: EntryDraft) => boolean) =>
    entries.filter((e) => e.status === "APPLIED" && pred(e)).reduce((s, e) => s + e.amount, 0);

  const totalBonus = sum((e) => e.type === "BONUS");
  const totalPenalty = Math.abs(sum((e) => e.type === "DENDA"));
  const totalDeduction = Math.abs(sum((e) => e.type === "POTONGAN"));
  const totalAllowance = sum((e) => e.type === "TUNJANGAN");

  const c = calc.components;
  // Gaji kotor = komponen tetap + tunjangan tambahan. `totalGrossFixed` dari
  // perhitungan sudah memuat keduanya; dihitung ulang di sini akan menggandakan
  // tunjangan, jadi dipakai apa adanya.
  const grossPay = c.totalGrossFixed;
  const netPay = grossPay - totalDeduction - totalPenalty + totalBonus;

  return {
    baseSalary: c.baseSalary,
    mealAllowance: c.mealAllowance,
    transportAllowance: c.transportAllowance,
    positionAllowance: c.positionAllowance,
    bpjsKesehatan: c.bpjsKesehatan,
    totalBonus,
    totalPenalty,
    totalDeduction,
    totalAllowance,
    grossPay,
    netPay,
    needsReview: entries.some((e) => e.status !== "APPLIED" || e.flag != null),
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
    const sudahDibayar = await prisma.payrollRun.findFirst({
      where: { companyId, periodYear: year, periodMonth: month, status: "PAID" },
      select: { id: true },
    });
    if (sudahDibayar) {
      throw new ValidationError(
        "Gaji periode ini sudah dibayar dan tidak bisa dihitung ulang. " +
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
            entries: {
              create: entries.map((e) => ({
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
              })),
            },
          },
        });
      }

      return run;
    });
  },

  /**
   * Tandai run sudah dibayar.
   *
   * `finalizedAt` ikut diisi kalau belum: alur di halaman payroll hanya punya
   * satu tombol (Bayar), tapi kolom itu tetap harus terisi supaya riwayatnya
   * lengkap. Setelah PAID, isi run tidak boleh berubah lagi — generate ulang
   * membuat run baru dan tidak menyentuh yang ini.
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
    return prisma.payrollRun.update({
      where: { id: runId },
      data: {
        status: "PAID",
        paidAt: now,
        finalizedAt: run.finalizedAt ?? now,
        finalizedById: run.finalizedAt ? undefined : userId,
      },
    });
  },
};
