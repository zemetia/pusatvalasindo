export const maxDuration = 30; // extend Vercel function timeout to 30s

import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  IconUsers,
  IconBuilding,
  IconFingerprint,
  IconBuildingBank,
  IconTargetArrow,
  IconCoin,
  IconDatabase,
  IconListDetails,
  IconId,
  IconArrowUpRight,
  IconArrowDownRight,
  IconReport,
  IconUserCircle,
  IconAlertTriangle,
  IconUserOff,
  IconDashboard,
  IconClipboardCheck,
  IconClockCheck,
} from "@tabler/icons-react";
import {
  PageShell,
  PageHeader,
  SectionCard,
  EmptyState,
  ErrorPanel,
  MetricRow,
  MetricBlock,
  MetricLabel,
  DeltaPill,
} from "@/components/admin/page-shell";
import { getCaller } from "@/backend/helpers/get-admin-caller";
import { can, isGlobalRole, isAdminRole, PERMISSIONS } from "@/lib/permissions";

type Numeric = { toString(): string } | string | number | null | undefined;

function fmtRate(val: Numeric): string {
  if (val == null) return "-";
  return Number(val.toString()).toLocaleString("id-ID");
}

function fmtCurrency(val: Numeric, code = "IDR"): string {
  if (val == null) return "-";
  return `${code} ${Number(val.toString()).toLocaleString("id-ID")}`;
}

const statusLabel: Record<string, string> = {
  PRESENT: "Hadir",
  LATE: "Terlambat",
  ABSENT: "Tidak Hadir",
  PERMISSION: "Izin",
  SICK: "Sakit",
  HOLIDAY: "Libur",
};

// Skor KPI adalah rasio (1 = 100% target tercapai). Ambang ini hanya untuk
// menyorot performa tinggi di dashboard; nominal bonusnya ditentukan matriks
// insentif di modul payroll, bukan di sini.
const HIGH_PERFORMER_SCORE = 0.8;

function roleLabel(roleName: string): string {
  if (roleName === "SUPER_ADMIN") return "Super Admin";
  if (roleName === "OWNER") return "Owner";
  return roleName || "Pengguna";
}

/** Simbol mata uang untuk prefix angka — `Rp` untuk rupiah, kode ISO untuk sisanya. */
function currencySymbol(code: string): string {
  return code === "IDR" ? "Rp" : code;
}

/** Angka tanpa kode mata uang — kode/simbolnya dirender terpisah & meredup. */
function fmtAmount(val: Numeric): string {
  if (val == null) return "—";
  return Number(val.toString()).toLocaleString("id-ID");
}

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect(`/${locale}/login`);

  const caller = await getCaller();
  if (!caller) redirect(`/${locale}/login`);

  const { permissions, roleName, companyId, branchId, id: userId, payrollCompanyIds } = caller;
  const global = isGlobalRole(roleName);
  // Company-wide capable: global roles, plus Kepala Cabang (the only isAdminRole
  // scoped to one PT). Everyone else (Kasir, Teller, Sales, Kurir, ...) only ever
  // sees their own branch's operational data — HR/Akuntan-style roles get their
  // company-wide sections gated by the specific "_ALL"/"_MANAGE" permission below,
  // not by this flag.
  const companyWide = global || isAdminRole(roleName);
  const hasCompanyScope = global || !!companyId;
  // Sentinel-safe scoped ids for use inside `where` clauses guarded by
  // hasCompanyScope/global above (avoids non-null assertions).
  const scopedCompanyId = companyId ?? "__none__";
  const scopedBranchId = branchId ?? "__none__";

  const now = new Date();
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const monthStart = new Date(currentYear, currentMonth - 1, 1);
  const monthEnd = new Date(currentYear, currentMonth, 1);
  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;

  // ── Section visibility flags (permission-driven; mirrors app-sidebar.tsx) ──
  const showOwnAttendance = can(permissions, PERMISSIONS.ATTENDANCE_VIEW_OWN);
  const showOwnKpi = can(permissions, PERMISSIONS.KPI_VIEW_OWN);
  const showOwnPayroll = can(permissions, PERMISSIONS.PAYROLL_VIEW_OWN);
  const showSuspicious = can(permissions, PERMISSIONS.ATTENDANCE_MANAGE) && hasCompanyScope;
  const showCorrections = can(permissions, PERMISSIONS.CORRECTION_VIEW) && hasCompanyScope;
  const canApproveCorrections = can(permissions, PERMISSIONS.CORRECTION_APPROVE);
  const showUsersCount = can(permissions, PERMISSIONS.USERS_VIEW) && hasCompanyScope;
  const showBranchesCount = can(permissions, PERMISSIONS.BRANCHES_VIEW) && hasCompanyScope;
  const showAttendanceAll = can(permissions, PERMISSIONS.ATTENDANCE_VIEW_ALL) && hasCompanyScope;
  const showKpiAll = (can(permissions, PERMISSIONS.KPI_VIEW_ALL) || can(permissions, PERMISSIONS.KPI_MANAGE)) && hasCompanyScope;
  const showPayrollTeam =
    (can(permissions, PERMISSIONS.PAYROLL_MANAGE) ||
      can(permissions, PERMISSIONS.PAYROLL_VIEW_ALL) ||
      can(permissions, PERMISSIONS.PAYROLL_VIEW_COMPANY)) &&
    hasCompanyScope;
  const showStock = can(permissions, PERMISSIONS.STOCK_VIEW) && (global || (companyWide ? !!companyId : !!branchId));
  const showBank = can(permissions, PERMISSIONS.BANK_VIEW) && hasCompanyScope;
  const showStockistVerify = can(permissions, PERMISSIONS.STOCKIST_VERIFY);

  // Payroll team scope: which company IDs count toward "team payroll status".
  let payrollCompanyIdList: string[] | undefined; // undefined = no filter (global)
  if (global) {
    payrollCompanyIdList = undefined;
  } else if (can(permissions, PERMISSIONS.PAYROLL_MANAGE) || can(permissions, PERMISSIONS.PAYROLL_VIEW_ALL)) {
    payrollCompanyIdList = companyId ? [companyId] : [];
  } else if (can(permissions, PERMISSIONS.PAYROLL_VIEW_COMPANY)) {
    payrollCompanyIdList = payrollCompanyIds.length ? payrollCompanyIds : companyId ? [companyId] : [];
  } else {
    payrollCompanyIdList = [];
  }

  let dashboardData;
  try {
    dashboardData = await Promise.all([
      // Own attendance today
      showOwnAttendance
        ? prisma.attendance.findFirst({ where: { userId, date: todayDate } })
        : Promise.resolve(null),

      // Own KPI result this month
      showOwnKpi
        ? prisma.kpiMonthlyResult.findFirst({
            where: { employeeId: userId, month: currentMonth, year: currentYear },
          })
        : Promise.resolve(null),

      // Own KPI entries this month (progress indicator before results are calculated)
      showOwnKpi
        ? prisma.kpiEntry.count({
            where: { employeeId: userId, periodMonth: currentMonth, periodYear: currentYear },
          })
        : Promise.resolve(0),

      // Suspicious attendance today
      showSuspicious
        ? prisma.attendance.findMany({
            where: {
              date: todayDate,
              isLocationSuspect: true,
              ...(global ? {} : { user: { branch: { companyId: scopedCompanyId } } }),
            },
            include: { user: { select: { name: true, branch: { select: { name: true } } } } },
          })
        : Promise.resolve([]),

      // Pending correction requests
      showCorrections
        ? prisma.correctionRequest.findMany({
            where: { status: "PENDING", ...(global ? {} : { companyId: scopedCompanyId }) },
            orderBy: { requestedAt: "desc" },
            take: 5,
          })
        : Promise.resolve([]),

      // Active users count
      showUsersCount
        ? prisma.user.count({
            where: { isActive: true, ...(global ? {} : { branch: { companyId: scopedCompanyId } }) },
          })
        : Promise.resolve(0),

      // Active branches count
      showBranchesCount
        ? prisma.branch.count({
            where: { isActive: true, ...(global ? {} : { companyId: scopedCompanyId }) },
          })
        : Promise.resolve(0),

      // Today's attendance count (team)
      showAttendanceAll
        ? prisma.attendance.count({
            where: {
              date: todayDate,
              status: { in: ["PRESENT", "LATE"] },
              ...(global ? {} : { user: { branch: { companyId: scopedCompanyId } } }),
            },
          })
        : Promise.resolve(0),

      // KPI entries this month (team)
      showKpiAll
        ? prisma.kpiEntry.count({
            where: {
              periodMonth: currentMonth,
              periodYear: currentYear,
              ...(global ? {} : { employee: { branch: { companyId: scopedCompanyId } } }),
            },
          })
        : Promise.resolve(0),

      // Payroll: total active employees in scope
      showPayrollTeam
        ? prisma.user.count({
            where: {
              isActive: true,
              ...(payrollCompanyIdList !== undefined
                ? { branch: { companyId: { in: payrollCompanyIdList } } }
                : {}),
            },
          })
        : Promise.resolve(0),

      // Payroll: employees already calculated this month in scope
      showPayrollTeam
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

      // Currency stock / kurs
      showStock
        ? prisma.currencyStock.findMany({
            where: global
              ? {}
              : companyWide
                ? { branch: { companyId: scopedCompanyId } }
                : { branchId: scopedBranchId },
            include: { branch: true, currency: true },
            orderBy: [{ branch: { name: "asc" } }, { currency: { code: "asc" } }],
          })
        : Promise.resolve([]),

      // Today's attendance list (team)
      showAttendanceAll
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

      // Not-yet-checked-in list (team)
      showAttendanceAll
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

      // Bank accounts
      showBank
        ? prisma.bankAccount.findMany({
            where: { isActive: true, ...(global ? {} : { companyId: scopedCompanyId }) },
            include: { company: true, currency: true },
            orderBy: [{ company: { name: "asc" } }, { bankName: "asc" }],
          })
        : Promise.resolve([]),

      // Recent bank mutations
      showBank
        ? prisma.bankMutation.findMany({
            where: global ? {} : { bankAccount: { companyId: scopedCompanyId } },
            orderBy: { createdAt: "desc" },
            take: 8,
            include: { bankAccount: { include: { company: true, currency: true } } },
          })
        : Promise.resolve([]),

      // KPI leaderboard this month
      showKpiAll
        ? prisma.kpiMonthlyResult.findMany({
            where: {
              month: currentMonth,
              year: currentYear,
              ...(global ? {} : { employee: { branch: { companyId: scopedCompanyId } } }),
            },
            include: {
              employee: { select: { name: true, branch: { select: { name: true } } } },
            },
            orderBy: { totalScore: "desc" },
            take: 5,
          })
        : Promise.resolve([]),

      // KPI: rata-rata skor tim bulan ini & bulan lalu (untuk trend naik/turun)
      showKpiAll
        ? prisma.kpiMonthlyResult.aggregate({
            _avg: { totalScore: true },
            where: {
              month: currentMonth,
              year: currentYear,
              ...(global ? {} : { employee: { branch: { companyId: scopedCompanyId } } }),
            },
          })
        : Promise.resolve({ _avg: { totalScore: null } }),

      showKpiAll
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
      showPayrollTeam
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

      showPayrollTeam
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
      showStock
        ? prisma.stockMutation.findMany({
            where: {
              rate: { not: null },
              createdAt: { lt: todayDate },
              ...(global
                ? {}
                : companyWide
                  ? { branch: { companyId: scopedCompanyId } }
                  : { branchId: scopedBranchId }),
            },
            orderBy: { createdAt: "desc" },
            take: 300,
            select: { currencyId: true, rate: true },
          })
        : Promise.resolve([]),

      // Saldo bank harian (untuk trend naik/turun saldo per mata uang)
      showBank
        ? prisma.dailyBankEntry.findMany({
            where: { bankAccount: { ...(global ? {} : { companyId: scopedCompanyId }) } },
            orderBy: { date: "desc" },
            take: 200,
            select: { date: true, balance: true, bankAccount: { select: { currencyId: true } } },
          })
        : Promise.resolve([]),
    ]);
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    return (
      <ErrorPanel source="dashboard/page" message={msg} />
    );
  }

  const [
    ownAttendanceToday,
    ownKpiThisMonth,
    ownKpiLogsThisMonth,
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
    dailyBankEntriesRaw,
  ] = dashboardData as [
    Awaited<ReturnType<typeof prisma.attendance.findFirst>>,
    Awaited<ReturnType<typeof prisma.kpiMonthlyResult.findFirst>>,
    number,
    Awaited<ReturnType<typeof prisma.attendance.findMany<{ include: { user: { select: { name: true; branch: { select: { name: true } } } } } }>>>,
    Awaited<ReturnType<typeof prisma.correctionRequest.findMany>>,
    number,
    number,
    number,
    number,
    number,
    number,
    Awaited<ReturnType<typeof prisma.currencyStock.findMany<{ include: { branch: true; currency: true } }>>>,
    Awaited<ReturnType<typeof prisma.attendance.findMany<{ include: { user: { select: { name: true; branch: { select: { name: true } } } } } }>>>,
    { id: string; name: string; branch: { name: string } | null }[],
    Awaited<ReturnType<typeof prisma.bankAccount.findMany<{ include: { company: true; currency: true } }>>>,
    Awaited<ReturnType<typeof prisma.bankMutation.findMany<{ include: { bankAccount: { include: { company: true; currency: true } } } }>>>,
    Awaited<ReturnType<typeof prisma.kpiMonthlyResult.findMany<{ include: { employee: { select: { name: true; branch: { select: { name: true } } } } } }>>>,
    Awaited<ReturnType<typeof prisma.kpiMonthlyResult.aggregate<{ _avg: { totalScore: true } }>>>,
    Awaited<ReturnType<typeof prisma.kpiMonthlyResult.aggregate<{ _avg: { totalScore: true } }>>>,
    number,
    number,
    Awaited<ReturnType<typeof prisma.stockMutation.findMany<{ select: { currencyId: true; rate: true } }>>>,
    Awaited<
      ReturnType<
        typeof prisma.dailyBankEntry.findMany<{
          select: { date: true; balance: true; bankAccount: { select: { currencyId: true } } };
        }>
      >
    >,
  ];

  const activeBankAccountsCount = bankAccounts.length;

  // ── Trend & ringkasan turunan (dihitung dari data yang sudah diambil) ──────

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

  // currencyId -> rate transaksi terakhir sebelum hari ini (mutasi terurut desc, ambil kemunculan pertama)
  const prevRateByCurrency = new Map<string, number>();
  for (const m of prevRateMutations) {
    if (m.rate != null && !prevRateByCurrency.has(m.currencyId)) {
      prevRateByCurrency.set(m.currencyId, Number(m.rate.toString()));
    }
  }

  type CurrencyCard = {
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
  const currencyCards: CurrencyCard[] = Array.from(currencyAcc.entries())
    .map(([currencyId, g]) => {
      const avgBuy = g.buyCount ? g.buySum / g.buyCount : null;
      const avgSell = g.sellCount ? g.sellSum / g.sellCount : null;
      const marginPct = avgBuy && avgSell ? ((avgSell - avgBuy) / avgBuy) * 100 : null;
      const refRate = avgBuy ?? avgSell;
      const prevRate = prevRateByCurrency.get(currencyId) ?? null;
      const trendPct = refRate != null && prevRate ? ((refRate - prevRate) / prevRate) * 100 : null;
      return {
        currencyId,
        code: g.code,
        name: g.name,
        avgBuy,
        avgSell,
        marginPct,
        trendPct,
        quantity: g.quantity,
        branchCount: g.branchCount,
      };
    })
    .sort((a, b) => a.code.localeCompare(b.code));

  // Saldo bank dikelompokkan per mata uang — tidak dijumlah lintas mata uang karena nilainya tidak sepadan.
  type BankCurrencyGroup = { currencyId: string; code: string; total: number; count: number };
  const bankAcc = new Map<string, BankCurrencyGroup>();
  for (const acc of bankAccounts) {
    const g = bankAcc.get(acc.currencyId) ?? { currencyId: acc.currencyId, code: acc.currency.code, total: 0, count: 0 };
    g.total += Number(acc.balance.toString());
    g.count += 1;
    bankAcc.set(acc.currencyId, g);
  }
  const bankGroups = Array.from(bankAcc.values()).sort((a, b) => b.total - a.total);
  const primaryBankGroup = bankGroups.find((g) => g.code === "IDR") ?? bankGroups[0] ?? null;

  let bankTrendPct: number | null = null;
  if (primaryBankGroup) {
    const sumByDate = new Map<string, number>();
    for (const e of dailyBankEntriesRaw) {
      if (e.bankAccount.currencyId !== primaryBankGroup.currencyId) continue;
      const key = e.date.toISOString().slice(0, 10);
      sumByDate.set(key, (sumByDate.get(key) ?? 0) + Number(e.balance.toString()));
    }
    const sortedEntries = Array.from(sumByDate.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
    if (sortedEntries.length >= 2) {
      const [, latest] = sortedEntries[0];
      const [, prevVal] = sortedEntries[1];
      if (prevVal !== 0) bankTrendPct = ((latest - prevVal) / prevVal) * 100;
    }
  }

  const showBentoOverview =
    showUsersCount || showBranchesCount || showAttendanceAll || showKpiAll || showBank || showPayrollTeam;

  const quickLinksAll: {
    href: string;
    label: string;
    icon: typeof IconUsers;
    show: boolean;
  }[] = [
    { href: "/dashboard/attendance", label: "Presensi", icon: IconFingerprint, show: showOwnAttendance },
    { href: "/dashboard/kpi/self", label: "Isi KPI Saya", icon: IconTargetArrow, show: can(permissions, PERMISSIONS.KPI_FILL_OWN) },
    { href: "/dashboard/kpi", label: "Konfigurasi KPI", icon: IconTargetArrow, show: can(permissions, PERMISSIONS.KPI_MANAGE) },
    { href: "/dashboard/kpi/definitions", label: "Definisi KPI", icon: IconListDetails, show: can(permissions, PERMISSIONS.KPI_MANAGE) },
    { href: "/dashboard/kpi/log", label: "Log KPI", icon: IconReport, show: showKpiAll },
    { href: "/dashboard/payroll", label: "Hitung Gaji", icon: IconCoin, show: can(permissions, PERMISSIONS.PAYROLL_MANAGE) },
    { href: "/dashboard/bank-accounts", label: "Rekening Bank", icon: IconBuildingBank, show: showBank },
    { href: "/dashboard/stockist", label: "Stockist", icon: IconDatabase, show: can(permissions, PERMISSIONS.STOCKIST_VIEW) },
    { href: "/dashboard/stockist/konfirmasi", label: "Konfirmasi Stockist", icon: IconClipboardCheck, show: showStockistVerify },
    { href: "/dashboard/persetujuan-koreksi", label: "Persetujuan Koreksi", icon: IconClockCheck, show: canApproveCorrections },
    { href: "/dashboard/users", label: "Pengguna", icon: IconUsers, show: showUsersCount },
    { href: "/dashboard/branches", label: "Cabang", icon: IconBuilding, show: showBranchesCount },
    { href: "/dashboard/roles", label: "Role & Akses", icon: IconId, show: can(permissions, PERMISSIONS.ROLES_VIEW) },
    { href: "/dashboard/account", label: "Akun Saya", icon: IconUserCircle, show: true },
  ];
  const quickLinks = quickLinksAll.filter((l) => l.show);

  return (
    <PageShell>
      {/* Page Header */}
      <PageHeader
        title={`Halo, ${session.user.name?.split(" ")[0] ?? ""}`}
        description={`${roleLabel(roleName)} — ${now.toLocaleDateString("id-ID", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })}`}
        icon={<IconDashboard className="size-5" />}
      />

      {/* Alert: Presensi Mencurigakan */}
      {showSuspicious && suspectAttendance.length > 0 && (
        <Card className="border-warning/40 gap-0 overflow-hidden py-0">
          <CardHeader className="bg-warning-muted/60 border-b py-4">
            <div className="flex items-center gap-2">
              <IconAlertTriangle className="text-warning size-5" />
              <CardTitle className="text-warning-foreground text-sm">
                Presensi Lokasi Mencurigakan — {suspectAttendance.length} karyawan
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Karyawan</TableHead>
                  <TableHead>Cabang</TableHead>
                  <TableHead>Check In</TableHead>
                  <TableHead>Keterangan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suspectAttendance.map((att) => (
                  <TableRow key={att.id}>
                    <TableCell className="font-medium text-sm">{att.user.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{att.user.branch?.name ?? "-"}</TableCell>
                    <TableCell className="text-sm font-mono">
                      {att.checkIn
                        ? att.checkIn.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="danger">GPS Tidak Sesuai</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Alert: Pengajuan Koreksi Pending */}
      {showCorrections && pendingCorrections.length > 0 && (
        <Card className="border-info/40 gap-0 overflow-hidden py-0">
          <CardHeader className="bg-info-muted/60 border-b py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <IconClockCheck className="text-info size-5" />
                <CardTitle className="text-sm">
                  Pengajuan Koreksi Menunggu — {pendingCorrections.length}
                </CardTitle>
              </div>
              {canApproveCorrections && (
                <Button size="sm" variant="outline" asChild>
                  <Link href="/dashboard/persetujuan-koreksi">Tinjau →</Link>
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Target</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead className="text-right">Nilai Saat Ini</TableHead>
                  <TableHead className="text-right">Usulan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingCorrections.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium text-sm">{c.targetLabel}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.date.toLocaleDateString("id-ID", { day: "2-digit", month: "short" })}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{fmtRate(c.currentValue)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{fmtRate(c.proposedValue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Ringkasan Saya — blok data editorial, tanpa kartu */}
      {(showOwnAttendance || showOwnKpi || showOwnPayroll) && (
        <MetricRow title="Ringkasan Saya" columns={3}>
          {showOwnAttendance && (
            <MetricBlock
              label="Presensi Saya Hari Ini"
              size="secondary"
              tone={ownAttendanceToday ? "default" : "muted"}
              value={
                ownAttendanceToday?.checkIn
                  ? ownAttendanceToday.checkIn.toLocaleTimeString("id-ID", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "—"
              }
              meta={
                ownAttendanceToday ? (
                  <Badge
                    variant={
                      ownAttendanceToday.status === "PRESENT"
                        ? "success"
                        : ownAttendanceToday.status === "LATE"
                          ? "warning"
                          : "soft"
                    }
                  >
                    {statusLabel[ownAttendanceToday.status] ?? ownAttendanceToday.status}
                  </Badge>
                ) : (
                  "Belum absen hari ini"
                )
              }
              action={
                !ownAttendanceToday && (
                  <Button size="sm" asChild>
                    <Link href="/dashboard/attendance">Absen Sekarang</Link>
                  </Button>
                )
              }
            />
          )}

          {showOwnKpi && (
            <MetricBlock
              label="KPI Saya Bulan Ini"
              size="secondary"
              tone={ownKpiThisMonth ? "default" : "muted"}
              value={
                ownKpiThisMonth
                  ? `${(Number(ownKpiThisMonth.totalScore) * 100).toFixed(1)}%`
                  : "—"
              }
              meta={
                ownKpiThisMonth ? (
                  <Badge variant="soft">Grade {ownKpiThisMonth.grade}</Badge>
                ) : (
                  `${ownKpiLogsThisMonth} entri KPI tercatat bulan ini`
                )
              }
              action={
                !ownKpiThisMonth &&
                can(permissions, PERMISSIONS.KPI_FILL_OWN) && (
                  <Button size="sm" variant="outline" asChild>
                    <Link href="/dashboard/kpi/self">Isi KPI</Link>
                  </Button>
                )
              }
            />
          )}

          {showOwnPayroll && (
            <MetricBlock
              label="Status Gaji Saya"
              size="secondary"
              tone={ownKpiThisMonth ? "default" : "muted"}
              value={ownKpiThisMonth ? `Grade ${ownKpiThisMonth.grade}` : "—"}
              meta={
                ownKpiThisMonth
                  ? `Bonus/potongan ${now.toLocaleDateString("id-ID", { month: "long", year: "numeric" })} dihitung saat slip gaji dibuat`
                  : "KPI bulan ini belum dihitung"
              }
            />
          )}
        </MetricRow>
      )}

      {/* Ringkasan Bisnis — metrik utama, dipisah garis rambut bukan kartu */}
      {showBentoOverview && (
        <MetricRow title="Ringkasan Bisnis" columns={4} className="-mt-px">
          {showBank && primaryBankGroup && (
            <MetricBlock
              label="Saldo Bank"
              prefix={currencySymbol(primaryBankGroup.code)}
              value={fmtAmount(primaryBankGroup.total)}
              delta={bankTrendPct}
              period="vs hari sebelumnya"
              meta={
                <>
                  {primaryBankGroup.count} rekening {primaryBankGroup.code}
                  {bankGroups.length > 1 && (
                    <span className="text-muted-foreground">
                      {" · "}
                      {bankGroups
                        .filter((g) => g.currencyId !== primaryBankGroup.currencyId)
                        .map((g) => `${g.code} ${g.total.toLocaleString("id-ID")}`)
                        .join(" · ")}
                    </span>
                  )}
                </>
              }
            />
          )}

          {showAttendanceAll && (
            <MetricBlock
              label="Presensi Hari Ini"
              value={todayAttendanceCount.toLocaleString("id-ID")}
              suffix={`dari ${totalUsers}`}
              meta={
                attendancePct != null
                  ? `${attendancePct.toFixed(0)}% karyawan hadir`
                  : "Belum ada data kehadiran"
              }
            />
          )}

          {showKpiAll && (
            <MetricBlock
              label="KPI Bulan Ini"
              value={kpiAvgThisMonth != null ? kpiAvgThisMonth.toFixed(1) : kpiLogsThisMonth}
              delta={kpiTrendPct}
              period="vs bulan lalu"
              meta={
                kpiAvgThisMonth != null
                  ? `Rata-rata skor tim · ${kpiLogsThisMonth} entri`
                  : `${kpiLogsThisMonth} entri KPI tercatat`
              }
            />
          )}

          {showPayrollTeam && (
            <MetricBlock
              label="Payroll Bulan Ini"
              value={payrollDoneCount.toLocaleString("id-ID")}
              suffix={`/ ${payrollTotalEmployees}`}
              delta={highPerformerTrendPct}
              period={`${highPerformersThisMonth} skor ≥80% vs bulan lalu`}
              meta="karyawan sudah dihitung"
              action={
                can(permissions, PERMISSIONS.PAYROLL_MANAGE) &&
                payrollDoneCount < payrollTotalEmployees ? (
                  <Button size="sm" variant="outline" asChild>
                    <Link href="/dashboard/payroll">Hitung Gaji →</Link>
                  </Button>
                ) : payrollTotalEmployees > 0 ? (
                  <Badge variant="success">✓ Selesai</Badge>
                ) : undefined
              }
            />
          )}
        </MetricRow>
      )}

      {/* Organisasi */}
      {(showUsersCount || showBranchesCount) && (
        <MetricRow title="Organisasi" columns={2} className="-mt-px">
          {showUsersCount && (
            <MetricBlock
              label="Karyawan Aktif"
              size="secondary"
              value={totalUsers.toLocaleString("id-ID")}
              meta="Total karyawan terdaftar"
            />
          )}
          {showBranchesCount && (
            <MetricBlock
              label="Cabang Aktif"
              size="secondary"
              value={totalBranches.toLocaleString("id-ID")}
              meta="Cabang beroperasi"
            />
          )}
        </MetricRow>
      )}

      {/* Currency Rates + Quick Links */}
      <div className="grid gap-6 @xl/main:grid-cols-3">
        {showStock && (
          <div className="@xl/main:col-span-2">
            <SectionCard
              title="Kurs Mata Uang"
              description={`${currencyCards.length} mata uang aktif`}
              action={
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/dashboard/stockist">Lihat Semua →</Link>
                </Button>
              }
            >
              {currencyCards.length === 0 ? (
                <EmptyState
                  title="Belum ada data kurs mata uang"
                  description={
                    <>
                      Tambahkan melalui menu{" "}
                      <Link href="/dashboard/stockist" className="underline">
                        Stock Mata Uang
                      </Link>
                      .
                    </>
                  }
                />
              ) : (
                <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2 @2xl/main:grid-cols-3">
                  {currencyCards.map((c) => (
                    <div key={c.currencyId} className="border-border border-t pt-4">
                      <div className="flex items-baseline justify-between gap-2">
                        <div className="flex min-w-0 items-baseline gap-2">
                          <span className="font-mono text-sm font-medium">{c.code}</span>
                          <span className="text-muted-foreground truncate text-xs">{c.name}</span>
                        </div>
                        <DeltaPill value={c.trendPct} />
                      </div>
                      <div className="mt-3 flex items-start gap-8">
                        <div>
                          <MetricLabel>Beli</MetricLabel>
                          <p className="tabular mt-1 text-xl leading-none font-semibold tracking-tight">
                            {fmtRate(c.avgBuy)}
                          </p>
                        </div>
                        <div>
                          <MetricLabel>Jual</MetricLabel>
                          <p className="tabular mt-1 text-xl leading-none font-semibold tracking-tight">
                            {fmtRate(c.avgSell)}
                          </p>
                        </div>
                      </div>
                      <p className="text-muted-foreground mt-3 text-xs">
                        {c.branchCount} cabang · stok {c.quantity.toLocaleString("id-ID")}
                        {c.marginPct != null && (
                          <>
                            {" · "}
                            <span className="text-foreground font-medium">
                              margin {c.marginPct.toFixed(1).replace(".", ",")}%
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>
        )}

        {/* Quick Navigation */}
        <div className={showStock ? "" : "@xl/main:col-span-3"}>
          <SectionCard title="Navigasi Cepat">
            <div className="flex flex-col gap-2">
              {quickLinks.map(({ href, label, icon: Icon }) => (
                <Button
                  key={href}
                  variant="outline"
                  size="sm"
                  asChild
                  className="justify-start gap-2"
                >
                  <Link href={href}>
                    <Icon className="size-4 shrink-0" />
                    {label}
                  </Link>
                </Button>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>

      {/* Belum Absen + Kehadiran Hari Ini */}
      {showAttendanceAll && (
        <div className="grid gap-6 @xl/main:grid-cols-2">
          <SectionCard
            title="Belum Absen Hari Ini"
            icon={<IconUserOff className="size-4" />}
            padded={false}
            className={notYetAbsent.length > 0 ? "border-warning/40" : ""}
            action={
              notYetAbsent.length > 0 ? (
                <Badge variant="warning">{notYetAbsent.length} karyawan</Badge>
              ) : undefined
            }
          >
              {notYetAbsent.length === 0 ? (
                <EmptyState title="✓ Semua karyawan sudah absen" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Karyawan</TableHead>
                      <TableHead>Cabang</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {notYetAbsent.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium text-sm">{u.name}</TableCell>
                        <TableCell className="text-muted-foreground">{u.branch?.name ?? "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
          </SectionCard>

          <SectionCard
            title="Kehadiran Hari Ini"
            padded={false}
            action={
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard/attendance">Lihat →</Link>
              </Button>
            }
          >
              {todayAttendanceList.length === 0 ? (
                <EmptyState title="Belum ada presensi hari ini" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Karyawan</TableHead>
                      <TableHead>Cabang</TableHead>
                      <TableHead>Check In</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {todayAttendanceList.map((att) => (
                      <TableRow key={att.id}>
                        <TableCell className="font-medium text-sm">{att.user.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{att.user.branch?.name ?? "-"}</TableCell>
                        <TableCell className="text-sm font-mono">
                          {att.checkIn
                            ? att.checkIn.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              att.status === "PRESENT"
                                ? "success"
                                : att.status === "LATE"
                                  ? "warning"
                                  : "soft"
                            }
                          >
                            {statusLabel[att.status] ?? att.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
          </SectionCard>
        </div>
      )}

      {/* Bank Mutations + Bank Accounts */}
      {showBank && (
        <div className="grid gap-6 @xl/main:grid-cols-2">
          <SectionCard
            title="Mutasi Bank Terbaru"
            padded={false}
            action={
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard/bank-accounts">Lihat →</Link>
              </Button>
            }
          >
              {recentMutations.length === 0 ? (
                <EmptyState title="Belum ada mutasi bank" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bank / Cabang</TableHead>
                      <TableHead>Jenis</TableHead>
                      <TableHead className="text-right">Jumlah</TableHead>
                      <TableHead>Tanggal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentMutations.map((mut) => (
                      <TableRow key={mut.id}>
                        <TableCell className="text-sm">
                          <div className="font-medium">{mut.bankAccount.bankName}</div>
                          <div className="text-xs text-muted-foreground">{mut.bankAccount.company.name}</div>
                        </TableCell>
                        <TableCell>
                          {mut.type === "CREDIT" ? (
                            <span className="text-success flex items-center gap-1 text-sm font-medium">
                              <IconArrowUpRight className="size-3.5" />
                              Masuk
                            </span>
                          ) : (
                            <span className="text-destructive flex items-center gap-1 text-sm font-medium">
                              <IconArrowDownRight className="size-3.5" />
                              Keluar
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="tabular text-right">
                          {fmtCurrency(mut.amount, mut.bankAccount.currency.code)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {mut.createdAt.toLocaleDateString("id-ID", { day: "2-digit", month: "short" })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
          </SectionCard>

          <SectionCard
            title="Rekening Bank Aktif"
            description={`${activeBankAccountsCount} rekening${global ? " di semua PT" : ""}`}
            padded={false}
            action={
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard/bank-accounts">Kelola →</Link>
              </Button>
            }
          >
              {bankAccounts.length === 0 ? (
                <EmptyState title="Belum ada rekening bank aktif" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>PT</TableHead>
                      <TableHead>Bank</TableHead>
                      <TableHead>Mata Uang</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bankAccounts.map((acc) => (
                      <TableRow key={acc.id}>
                        <TableCell className="text-sm">{acc.company.name}</TableCell>
                        <TableCell className="font-medium text-sm">{acc.bankName}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono">
                            {acc.currency.code}
                          </Badge>
                        </TableCell>
                        <TableCell className="tabular text-right font-medium">
                          {fmtCurrency(acc.balance, acc.currency.code)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
          </SectionCard>
        </div>
      )}

      {/* KPI Monthly Results */}
      {showKpiAll && kpiResults.length > 0 && (
        <SectionCard
          title="Hasil KPI Bulan Ini"
          description={`Top performers — ${now.toLocaleDateString("id-ID", {
            month: "long",
            year: "numeric",
          })}`}
          padded={false}
          action={
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/kpi/log">Lihat Log →</Link>
            </Button>
          }
        >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Karyawan</TableHead>
                  <TableHead>Cabang</TableHead>
                  <TableHead className="text-right">Total Skor</TableHead>
                  <TableHead>Grade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {kpiResults.map((r, i) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-muted-foreground tabular">{i + 1}</TableCell>
                    <TableCell className="font-medium">{r.employee.name}</TableCell>
                    <TableCell className="text-muted-foreground">{r.employee.branch?.name ?? "-"}</TableCell>
                    <TableCell className="tabular text-right font-medium">
                      {(Number(r.totalScore) * 100).toFixed(1)}%
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          r.grade === "A" || r.grade === "B" ? "success" : "soft"
                        }
                      >
                        {r.grade}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
        </SectionCard>
      )}
    </PageShell>
  );
}
