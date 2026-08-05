// ─── Data + format helpers bersama untuk dashboard per-role ──────────────────
// dashboard-owner.tsx, dashboard-kepala-cabang.tsx, dan dashboard-pegawai.tsx
// masing-masing halaman penuh yang independen (lihat komponennya), tapi ketiganya
// butuh query Prisma & perhitungan turunan (kurs, saldo bank, trend) yang sama.
// Query/format mentah tinggal di sini; layout & susunan section tetap di masing-
// masing komponen dashboard supaya tidak balik jadi satu file dengan flag isRoleX.

import prisma from "@/lib/prisma";

export type Numeric = { toString(): string } | string | number | null | undefined;

export function fmtRate(val: Numeric): string {
  if (val == null) return "-";
  return Number(val.toString()).toLocaleString("id-ID");
}

export function fmtCurrency(val: Numeric, code = "IDR"): string {
  if (val == null) return "-";
  return `${code} ${Number(val.toString()).toLocaleString("id-ID")}`;
}

/** Angka tanpa kode mata uang — kode/simbolnya dirender terpisah & meredup. */
export function fmtAmount(val: Numeric): string {
  if (val == null) return "—";
  return Number(val.toString()).toLocaleString("id-ID");
}

/** Simbol mata uang untuk prefix angka — `Rp` untuk rupiah, kode ISO untuk sisanya. */
export function currencySymbol(code: string): string {
  return code === "IDR" ? "Rp" : code;
}

export const statusLabel: Record<string, string> = {
  PRESENT: "Hadir",
  LATE: "Terlambat",
  WFH: "WFH",
  ABSENT: "Tidak Hadir",
  PERMISSION: "Izin",
  SICK: "Sakit",
  LEAVE: "Cuti",
  HOLIDAY: "Libur",
};

// Skor KPI adalah rasio (1 = 100% target tercapai). Ambang ini hanya untuk
// menyorot performa tinggi di dashboard; nominal bonusnya ditentukan matriks
// insentif di modul payroll, bukan di sini.
export const HIGH_PERFORMER_SCORE = 0.8;

export function roleLabel(roleName: string): string {
  if (roleName === "SUPER_ADMIN") return "Super Admin";
  if (roleName === "OWNER") return "Owner";
  return roleName || "Pengguna";
}

/**
 * Menentukan komponen dashboard mana yang dipakai untuk sebuah role. Tambah
 * role baru ke bucket yang sesuai di sini — jangan tambah flag `isRoleX` baru
 * di komponen dashboard manapun.
 */
export type DashboardBucket = "owner" | "kepala_cabang" | "pegawai";
export function getDashboardBucket(roleName: string): DashboardBucket {
  if (roleName === "OWNER" || roleName === "SUPER_ADMIN") return "owner";
  if (roleName === "KEPALA_CABANG") return "kepala_cabang";
  return "pegawai";
}

/** Titik waktu & rentang bulan berjalan/sebelumnya, dipakai oleh semua query dashboard. */
export function getDashboardPeriod() {
  const now = new Date();
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
  return { now, todayDate, currentMonth, currentYear, prevMonth, prevYear };
}

// ── Ringkasan pribadi (presensi/KPI hari ini & bulan ini milik satu user) ────

export async function getOwnSummary(params: { userId: string; month: number; year: number; todayDate: Date }) {
  const { userId, month, year, todayDate } = params;
  const [ownAttendanceToday, ownKpiThisMonth, ownKpiLogsThisMonth] = await Promise.all([
    prisma.attendance.findFirst({ where: { userId, date: todayDate } }),
    prisma.kpiMonthlyResult.findFirst({ where: { employeeId: userId, month, year } }),
    prisma.kpiEntry.count({ where: { employeeId: userId, periodMonth: month, periodYear: year } }),
  ]);
  return { ownAttendanceToday, ownKpiThisMonth, ownKpiLogsThisMonth };
}

// ── Ringkasan bisnis lintas-tim (bank, presensi tim, KPI tim, payroll tim, kurs) ──

export type CompanyOverviewScope = {
  /** Role global (Super Admin/Owner) — tanpa filter PT sama sekali. */
  global: boolean;
  /** Boleh melihat lintas cabang dalam satu PT (Owner/Super Admin/Kepala Cabang). */
  companyWide: boolean;
  companyId: string | null;
  branchId: string | null;
};

export type CompanyOverviewFlags = {
  suspicious: boolean;
  corrections: boolean;
  usersCount: boolean;
  branchesCount: boolean;
  attendanceAll: boolean;
  kpiAll: boolean;
  payrollTeam: boolean;
  stock: boolean;
  bank: boolean;
};

export async function getCompanyOverview(params: {
  flags: CompanyOverviewFlags;
  scope: CompanyOverviewScope;
  todayDate: Date;
  currentMonth: number;
  currentYear: number;
  prevMonth: number;
  prevYear: number;
  /** undefined = seluruh PT, [] = tidak ada PT (gagal ke arah aman), string[] = PT tertentu. */
  payrollCompanyIdList: string[] | undefined;
}) {
  const { flags, scope, todayDate, currentMonth, currentYear, prevMonth, prevYear, payrollCompanyIdList } = params;
  const { global, companyWide, companyId, branchId } = scope;
  const scopedCompanyId = companyId ?? "__none__";
  const scopedBranchId = branchId ?? "__none__";

  const [
    suspectAttendance,
    pendingCorrections,
    totalUsers,
    totalBranches,
    todayAttendanceCount,
    kpiLogsThisMonth,
    payrollTotalEmployees,
    payrollDoneCount,
    currencyStocks,
    todayAttendanceList,
    notYetAbsent,
    bankAccounts,
    recentMutations,
    kpiResults,
    kpiAvgThisMonthAgg,
    kpiAvgPrevMonthAgg,
    highPerformersThisMonth,
    highPerformersPrevMonth,
    prevRateMutations,
    dailyBankBalances,
  ] = await Promise.all([
    flags.suspicious
      ? prisma.attendance.findMany({
          where: {
            date: todayDate,
            isLocationSuspect: true,
            ...(global ? {} : { user: { branch: { companyId: scopedCompanyId } } }),
          },
          include: { user: { select: { name: true, branch: { select: { name: true } } } } },
        })
      : Promise.resolve([]),

    flags.corrections
      ? prisma.correctionRequest.findMany({
          where: { status: "PENDING", ...(global ? {} : { companyId: scopedCompanyId }) },
          orderBy: { requestedAt: "desc" },
          take: 5,
        })
      : Promise.resolve([]),

    flags.usersCount
      ? prisma.user.count({
          where: { isActive: true, ...(global ? {} : { branch: { companyId: scopedCompanyId } }) },
        })
      : Promise.resolve(0),

    flags.branchesCount
      ? prisma.branch.count({
          where: { isActive: true, ...(global ? {} : { companyId: scopedCompanyId }) },
        })
      : Promise.resolve(0),

    flags.attendanceAll
      ? prisma.attendance.count({
          where: {
            date: todayDate,
            status: { in: ["PRESENT", "LATE"] },
            ...(global ? {} : { user: { branch: { companyId: scopedCompanyId } } }),
          },
        })
      : Promise.resolve(0),

    flags.kpiAll
      ? prisma.kpiEntry.count({
          where: {
            periodMonth: currentMonth,
            periodYear: currentYear,
            ...(global ? {} : { employee: { branch: { companyId: scopedCompanyId } } }),
          },
        })
      : Promise.resolve(0),

    flags.payrollTeam
      ? prisma.user.count({
          where: {
            isActive: true,
            ...(payrollCompanyIdList !== undefined ? { branch: { companyId: { in: payrollCompanyIdList } } } : {}),
          },
        })
      : Promise.resolve(0),

    flags.payrollTeam
      ? prisma.kpiMonthlyResult.count({
          where: {
            month: currentMonth,
            year: currentYear,
            ...(payrollCompanyIdList !== undefined
              ? { employee: { branch: { companyId: { in: payrollCompanyIdList } } } }
              : {}),
          },
        })
      : Promise.resolve(0),

    flags.stock
      ? prisma.currencyStock.findMany({
          where: global ? {} : companyWide ? { branch: { companyId: scopedCompanyId } } : { branchId: scopedBranchId },
          include: { branch: true, currency: true },
          orderBy: [{ branch: { name: "asc" } }, { currency: { code: "asc" } }],
        })
      : Promise.resolve([]),

    flags.attendanceAll
      ? prisma.attendance.findMany({
          where: {
            date: todayDate,
            ...(global ? {} : { user: { branch: { companyId: scopedCompanyId } } }),
          },
          include: { user: { select: { name: true, branch: { select: { name: true } } } } },
          orderBy: { checkIn: "desc" },
          take: 8,
        })
      : Promise.resolve([]),

    flags.attendanceAll
      ? prisma.user.findMany({
          where: {
            isActive: true,
            attendances: { none: { date: todayDate } },
            ...(global ? {} : { branch: { companyId: scopedCompanyId } }),
          },
          select: { id: true, name: true, branch: { select: { name: true } } },
          orderBy: [{ branch: { name: "asc" } }, { name: "asc" }],
          take: 8,
        })
      : Promise.resolve([]),

    flags.bank
      ? prisma.bankAccount.findMany({
          where: { isActive: true, ...(global ? {} : { companyId: scopedCompanyId }) },
          include: { company: true, currency: true },
          orderBy: [{ company: { name: "asc" } }, { bankName: "asc" }],
        })
      : Promise.resolve([]),

    flags.bank
      ? prisma.bankMutation.findMany({
          where: global ? {} : { bankAccount: { companyId: scopedCompanyId } },
          orderBy: { createdAt: "desc" },
          take: 8,
          include: { bankAccount: { include: { company: true, currency: true } } },
        })
      : Promise.resolve([]),

    flags.kpiAll
      ? prisma.kpiMonthlyResult.findMany({
          where: {
            month: currentMonth,
            year: currentYear,
            ...(global ? {} : { employee: { branch: { companyId: scopedCompanyId } } }),
          },
          include: { employee: { select: { name: true, branch: { select: { name: true } } } } },
          orderBy: { totalScore: "desc" },
          take: 5,
        })
      : Promise.resolve([]),

    flags.kpiAll
      ? prisma.kpiMonthlyResult.aggregate({
          _avg: { totalScore: true },
          where: {
            month: currentMonth,
            year: currentYear,
            ...(global ? {} : { employee: { branch: { companyId: scopedCompanyId } } }),
          },
        })
      : Promise.resolve({ _avg: { totalScore: null } }),

    flags.kpiAll
      ? prisma.kpiMonthlyResult.aggregate({
          _avg: { totalScore: true },
          where: {
            month: prevMonth,
            year: prevYear,
            ...(global ? {} : { employee: { branch: { companyId: scopedCompanyId } } }),
          },
        })
      : Promise.resolve({ _avg: { totalScore: null } }),

    // Jumlah karyawan berkinerja tinggi bulan ini & bulan lalu (untuk trend).
    // Nominal bonusnya tidak diagregasi di sini: bonus top performer perlu
    // memeringkat antar-karyawan dan dihitung payroll saat slip dibuat.
    flags.payrollTeam
      ? prisma.kpiMonthlyResult.count({
          where: {
            month: currentMonth,
            year: currentYear,
            totalScore: { gte: HIGH_PERFORMER_SCORE },
            ...(payrollCompanyIdList !== undefined
              ? { employee: { branch: { companyId: { in: payrollCompanyIdList } } } }
              : {}),
          },
        })
      : Promise.resolve(0),

    flags.payrollTeam
      ? prisma.kpiMonthlyResult.count({
          where: {
            month: prevMonth,
            year: prevYear,
            totalScore: { gte: HIGH_PERFORMER_SCORE },
            ...(payrollCompanyIdList !== undefined
              ? { employee: { branch: { companyId: { in: payrollCompanyIdList } } } }
              : {}),
          },
        })
      : Promise.resolve(0),

    // Kurs mata uang: rate transaksi terakhir sebelum hari ini (pembanding trend)
    flags.stock
      ? prisma.stockMutation.findMany({
          where: {
            rate: { not: null },
            createdAt: { lt: todayDate },
            ...(global ? {} : companyWide ? { branch: { companyId: scopedCompanyId } } : { branchId: scopedBranchId }),
          },
          orderBy: { createdAt: "desc" },
          take: 300,
          select: { currencyId: true, rate: true },
        })
      : Promise.resolve([]),

    // Saldo bank = input Saldo Bank Harian, BUKAN BankAccount.balance (yang cuma
    // buku besar mutasi dan sering ketinggalan dari angka real rekening). Diambil
    // dua isian terakhir per rekening: rn=1 saldo berjalan, rn=2 pembanding trend.
    flags.bank ? fetchLatestDailyBankBalances(global ? null : scopedCompanyId, todayDate) : Promise.resolve([]),
  ]);

  const attendancePct = totalUsers > 0 ? (todayAttendanceCount / totalUsers) * 100 : null;

  const kpiAvgThisMonth =
    kpiAvgThisMonthAgg._avg.totalScore != null ? Number(kpiAvgThisMonthAgg._avg.totalScore.toString()) : null;
  const kpiAvgPrevMonth =
    kpiAvgPrevMonthAgg._avg.totalScore != null ? Number(kpiAvgPrevMonthAgg._avg.totalScore.toString()) : null;
  const kpiTrendPct =
    kpiAvgThisMonth != null && kpiAvgPrevMonth ? ((kpiAvgThisMonth - kpiAvgPrevMonth) / kpiAvgPrevMonth) * 100 : null;

  const highPerformerTrendPct =
    highPerformersPrevMonth > 0
      ? ((highPerformersThisMonth - highPerformersPrevMonth) / highPerformersPrevMonth) * 100
      : null;

  return {
    suspectAttendance,
    pendingCorrections,
    totalUsers,
    totalBranches,
    todayAttendanceCount,
    attendancePct,
    kpiLogsThisMonth,
    payrollTotalEmployees,
    payrollDoneCount,
    currencyStocks,
    todayAttendanceList,
    notYetAbsent,
    bankAccounts,
    recentMutations,
    kpiResults,
    kpiAvgThisMonth,
    kpiTrendPct,
    highPerformersThisMonth,
    highPerformerTrendPct,
    prevRateMutations,
    dailyBankBalances,
  };
}

// ── Saldo bank harian ────────────────────────────────────────────────────────

/** Dua isian Saldo Bank Harian terakhir per rekening aktif (rn 1 = terbaru). */
export type DailyBankBalanceRow = {
  bankAccountId: string;
  currencyId: string;
  balance: string;
  rn: number;
};

async function fetchLatestDailyBankBalances(companyId: string | null, todayDate: Date): Promise<DailyBankBalanceRow[]> {
  // `date` bertipe DATE murni, jadi dibandingkan sebagai string YYYY-MM-DD lokal —
  // kalau Date JS dikirim apa adanya, konversi timezone bisa membuang isian hari ini.
  const today = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, "0")}-${String(
    todayDate.getDate()
  ).padStart(2, "0")}`;

  const rows = companyId
    ? await prisma.$queryRaw<DailyBankBalanceRow[]>`
        SELECT * FROM (
          SELECT e."bankAccountId" AS "bankAccountId",
                 a."currencyId"    AS "currencyId",
                 e."balance"::text AS "balance",
                 (ROW_NUMBER() OVER (PARTITION BY e."bankAccountId" ORDER BY e."date" DESC))::int AS "rn"
          FROM "DailyBankEntry" e
          JOIN "BankAccount" a ON a."id" = e."bankAccountId"
          WHERE a."isActive" = true AND a."companyId" = ${companyId} AND e."date" <= ${today}::date
        ) t WHERE t."rn" <= 2`
    : await prisma.$queryRaw<DailyBankBalanceRow[]>`
        SELECT * FROM (
          SELECT e."bankAccountId" AS "bankAccountId",
                 a."currencyId"    AS "currencyId",
                 e."balance"::text AS "balance",
                 (ROW_NUMBER() OVER (PARTITION BY e."bankAccountId" ORDER BY e."date" DESC))::int AS "rn"
          FROM "DailyBankEntry" e
          JOIN "BankAccount" a ON a."id" = e."bankAccountId"
          WHERE a."isActive" = true AND e."date" <= ${today}::date
        ) t WHERE t."rn" <= 2`;

  return rows;
}

/** Saldo terbaru per rekening (id rekening → nominal), dari isian harian. */
export function latestBalanceByAccount(rows: DailyBankBalanceRow[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    if (r.rn === 1) m.set(r.bankAccountId, Number(r.balance));
  }
  return m;
}

// ── Perhitungan turunan murni (tanpa I/O) dipakai oleh komponen dashboard ────

export type CurrencyCard = {
  currencyId: string;
  code: string;
  name: string;
  avgBuy: number | null;
  avgSell: number | null;
  marginPct: number | null;
  trendPct: number | null;
  quantity: number;
  branchCount: number;
};

/** Field Decimal yang tidak pernah null (beda dari `Numeric`, yang mengizinkan null untuk kolom opsional). */
type DecimalLike = { toString(): string };

type CurrencyStockRow = {
  currencyId: string;
  buyRate: Numeric;
  sellRate: Numeric;
  quantity: DecimalLike;
  currency: { code: string; name: string };
};
type RateMutationRow = { currencyId: string; rate: Numeric };

export function buildCurrencyCards(currencyStocks: CurrencyStockRow[], prevRateMutations: RateMutationRow[]): CurrencyCard[] {
  const prevRateByCurrency = new Map<string, number>();
  for (const m of prevRateMutations) {
    if (m.rate != null && !prevRateByCurrency.has(m.currencyId)) {
      prevRateByCurrency.set(m.currencyId, Number(m.rate.toString()));
    }
  }

  const currencyAcc = new Map<
    string,
    { code: string; name: string; buySum: number; buyCount: number; sellSum: number; sellCount: number; quantity: number; branchCount: number }
  >();
  for (const cs of currencyStocks) {
    const g = currencyAcc.get(cs.currencyId) ?? {
      code: cs.currency.code,
      name: cs.currency.name,
      buySum: 0,
      buyCount: 0,
      sellSum: 0,
      sellCount: 0,
      quantity: 0,
      branchCount: 0,
    };
    if (cs.buyRate != null) {
      g.buySum += Number(cs.buyRate.toString());
      g.buyCount += 1;
    }
    if (cs.sellRate != null) {
      g.sellSum += Number(cs.sellRate.toString());
      g.sellCount += 1;
    }
    g.quantity += Number(cs.quantity.toString());
    g.branchCount += 1;
    currencyAcc.set(cs.currencyId, g);
  }

  return Array.from(currencyAcc.entries())
    .map(([currencyId, g]) => {
      const avgBuy = g.buyCount ? g.buySum / g.buyCount : null;
      const avgSell = g.sellCount ? g.sellSum / g.sellCount : null;
      const marginPct = avgBuy && avgSell ? ((avgSell - avgBuy) / avgBuy) * 100 : null;
      const refRate = avgBuy ?? avgSell;
      const prevRate = prevRateByCurrency.get(currencyId) ?? null;
      const trendPct = refRate != null && prevRate ? ((refRate - prevRate) / prevRate) * 100 : null;
      return { currencyId, code: g.code, name: g.name, avgBuy, avgSell, marginPct, trendPct, quantity: g.quantity, branchCount: g.branchCount };
    })
    .sort((a, b) => a.code.localeCompare(b.code));
}

export type BankCurrencyGroup = {
  currencyId: string;
  code: string;
  total: number;
  count: number;
  /** Rekening yang sudah punya isian saldo harian — sisanya belum menyumbang total. */
  filledCount: number;
};
type BankAccountRow = { id: string; currencyId: string; currency: { code: string } };

/**
 * Total saldo bank per mata uang dari isian **Saldo Bank Harian** terakhir tiap
 * rekening. Sengaja tidak memakai `BankAccount.balance`: kolom itu hasil akumulasi
 * BankMutation dan bukan angka yang diinput kasir tiap hari, jadi dulu ringkasan
 * dashboard bisa jauh meleset dari halaman Saldo Bank Harian.
 * Rekening yang belum pernah diisi dihitung 0 (tapi tetap masuk `count`).
 */
export function buildBankGroups(bankAccounts: BankAccountRow[], dailyBalances: DailyBankBalanceRow[]): BankCurrencyGroup[] {
  const latest = latestBalanceByAccount(dailyBalances);
  const bankAcc = new Map<string, BankCurrencyGroup>();
  for (const acc of bankAccounts) {
    const g =
      bankAcc.get(acc.currencyId) ??
      { currencyId: acc.currencyId, code: acc.currency.code, total: 0, count: 0, filledCount: 0 };
    const bal = latest.get(acc.id);
    if (bal != null) {
      g.total += bal;
      g.filledCount += 1;
    }
    g.count += 1;
    bankAcc.set(acc.currencyId, g);
  }
  return Array.from(bankAcc.values()).sort((a, b) => b.total - a.total);
}

/**
 * Trend saldo bank (%) untuk mata uang utama: total isian terakhir vs isian
 * sebelumnya, dibandingkan **per rekening**. Rekening yang baru punya satu isian
 * dianggap tidak berubah, supaya rekening yang telat input tidak bikin trend meledak.
 */
export function computeBankTrend(dailyBalances: DailyBankBalanceRow[], primaryGroup: BankCurrencyGroup | null): number | null {
  if (!primaryGroup) return null;
  const current = new Map<string, number>();
  const previous = new Map<string, number>();
  for (const r of dailyBalances) {
    if (r.currencyId !== primaryGroup.currencyId) continue;
    (r.rn === 1 ? current : previous).set(r.bankAccountId, Number(r.balance));
  }
  if (current.size === 0) return null;
  let latestTotal = 0;
  let prevTotal = 0;
  let hasHistory = false;
  for (const [accountId, bal] of current) {
    latestTotal += bal;
    const prev = previous.get(accountId);
    if (prev != null) hasHistory = true;
    prevTotal += prev ?? bal;
  }
  if (!hasHistory || prevTotal === 0) return null;
  return ((latestTotal - prevTotal) / prevTotal) * 100;
}
