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
  IconChartBar,
  IconDashboard,
  IconClipboardCheck,
  IconWallet,
  IconClockCheck,
} from "@tabler/icons-react";
import { PageHeader } from "@/components/admin/page-header";
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

const bonusLabel: Record<string, string> = {
  BONUS_CASH: "Bonus",
  TOP_PERFORMER: "Top Performer",
  SAFE_ZONE: "Safe Zone",
  PENALTY_SATURDAY: "Penalti Sabtu",
  PENALTY_DEDUCTION: "Penalti Potong",
};

function roleLabel(roleName: string): string {
  if (roleName === "SUPER_ADMIN") return "Super Admin";
  if (roleName === "OWNER") return "Owner";
  return roleName || "Pengguna";
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

      // Own KPI logs entered this month (progress indicator before results are calculated)
      showOwnKpi
        ? prisma.kpiLog.count({
            where: { employeeId: userId, createdAt: { gte: monthStart, lt: monthEnd } },
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

      // KPI logs this month (team)
      showKpiAll
        ? prisma.kpiLog.count({
            where: {
              createdAt: { gte: monthStart, lt: monthEnd },
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
    ]);
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    return (
      <div className="flex min-h-[400px] items-center justify-center p-8">
        <pre className="max-w-2xl whitespace-pre-wrap break-all rounded bg-destructive/10 p-6 text-sm text-destructive font-mono border border-destructive/30">
          {`[dashboard/page — fetch error]\n\n${msg}`}
        </pre>
      </div>
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
  ];

  const activeBankAccountsCount = bankAccounts.length;

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
    { href: "/dashboard/stockist", label: "Stock Mata Uang", icon: IconDatabase, show: can(permissions, PERMISSIONS.STOCKIST_VIEW) },
    { href: "/dashboard/stockist/konfirmasi", label: "Konfirmasi Stockist", icon: IconClipboardCheck, show: showStockistVerify },
    { href: "/dashboard/persetujuan-koreksi", label: "Persetujuan Koreksi", icon: IconClockCheck, show: canApproveCorrections },
    { href: "/dashboard/users", label: "Pengguna", icon: IconUsers, show: showUsersCount },
    { href: "/dashboard/branches", label: "Cabang", icon: IconBuilding, show: showBranchesCount },
    { href: "/dashboard/roles", label: "Role & Akses", icon: IconId, show: can(permissions, PERMISSIONS.ROLES_VIEW) },
    { href: "/dashboard/account", label: "Akun Saya", icon: IconUserCircle, show: true },
  ];
  const quickLinks = quickLinksAll.filter((l) => l.show);

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
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
        <Card className="border-orange-300 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/30">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <IconAlertTriangle className="size-5 text-orange-500" />
              <CardTitle className="text-base text-orange-700 dark:text-orange-400">
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
                      <Badge variant="destructive" className="text-xs">GPS Tidak Sesuai</Badge>
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
        <Card className="border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <IconClockCheck className="size-5 text-blue-500" />
                <CardTitle className="text-base text-blue-700 dark:text-blue-400">
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

      {/* Ringkasan Saya (personal) */}
      {(showOwnAttendance || showOwnKpi || showOwnPayroll) && (
        <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-3">
          {showOwnAttendance && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">Presensi Saya Hari Ini</CardTitle>
                <IconClockCheck className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {ownAttendanceToday ? (
                  <>
                    <div className="text-2xl font-bold font-mono">
                      {ownAttendanceToday.checkIn
                        ? ownAttendanceToday.checkIn.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
                        : "-"}
                    </div>
                    <Badge
                      variant={
                        ownAttendanceToday.status === "PRESENT"
                          ? "default"
                          : ownAttendanceToday.status === "LATE"
                            ? "destructive"
                            : "secondary"
                      }
                      className="mt-1 text-xs"
                    >
                      {statusLabel[ownAttendanceToday.status] ?? ownAttendanceToday.status}
                    </Badge>
                  </>
                ) : (
                  <>
                    <div className="text-sm text-muted-foreground mb-2">Belum absen hari ini</div>
                    <Button size="sm" asChild>
                      <Link href="/dashboard/attendance">Absen Sekarang</Link>
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {showOwnKpi && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">KPI Saya Bulan Ini</CardTitle>
                <IconTargetArrow className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {ownKpiThisMonth ? (
                  <>
                    <div className="text-2xl font-bold">{Number(ownKpiThisMonth.totalScore).toFixed(1)}</div>
                    {ownKpiThisMonth.bonusResult && (
                      <Badge className="mt-1 text-xs">
                        {bonusLabel[ownKpiThisMonth.bonusResult] ?? ownKpiThisMonth.bonusResult}
                      </Badge>
                    )}
                  </>
                ) : (
                  <>
                    <div className="text-sm text-muted-foreground mb-2">
                      {ownKpiLogsThisMonth} entri KPI tercatat bulan ini
                    </div>
                    {can(permissions, PERMISSIONS.KPI_FILL_OWN) && (
                      <Button size="sm" variant="outline" asChild>
                        <Link href="/dashboard/kpi/self">Isi KPI</Link>
                      </Button>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {showOwnPayroll && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">Status Gaji Saya</CardTitle>
                <IconWallet className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {ownKpiThisMonth?.bonusAmount != null ? (
                  <div className="text-2xl font-bold">{fmtCurrency(ownKpiThisMonth.bonusAmount)}</div>
                ) : (
                  <div className="text-sm text-muted-foreground">Belum dihitung bulan ini</div>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {now.toLocaleDateString("id-ID", { month: "long", year: "numeric" })}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Summary Cards (team) */}
      {(showUsersCount || showBranchesCount || showAttendanceAll || showKpiAll) && (
        <div className="grid grid-cols-2 gap-4 @xl/main:grid-cols-4">
          {showUsersCount && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">Karyawan Aktif</CardTitle>
                <IconUsers className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{totalUsers}</div>
                <p className="text-xs text-muted-foreground mt-1">Total karyawan terdaftar</p>
              </CardContent>
            </Card>
          )}

          {showBranchesCount && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">Cabang Aktif</CardTitle>
                <IconBuilding className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{totalBranches}</div>
                <p className="text-xs text-muted-foreground mt-1">Cabang beroperasi</p>
              </CardContent>
            </Card>
          )}

          {showAttendanceAll && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">Presensi Hari Ini</CardTitle>
                <IconFingerprint className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{todayAttendanceCount}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Hadir{totalUsers ? ` dari ${totalUsers} karyawan` : ""}
                </p>
              </CardContent>
            </Card>
          )}

          {showKpiAll && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">Log KPI Bulan Ini</CardTitle>
                <IconTargetArrow className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{kpiLogsThisMonth}</div>
                <p className="text-xs text-muted-foreground mt-1">Entri KPI dicatat</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Status Payroll (team) */}
      {showPayrollTeam && (
        <div className="grid gap-4 @xl/main:grid-cols-3">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Status Payroll</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {now.toLocaleDateString("id-ID", { month: "long", year: "numeric" })}
                  </p>
                </div>
                <IconChartBar className="size-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4">
                <div className="text-center">
                  <div className="text-4xl font-bold">
                    {payrollDoneCount}
                    <span className="text-xl font-normal text-muted-foreground">/{payrollTotalEmployees}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">karyawan sudah dihitung</p>
                </div>

                <div className="w-full bg-muted rounded-full h-2.5">
                  <div
                    className="bg-primary h-2.5 rounded-full transition-all"
                    style={{
                      width:
                        payrollTotalEmployees > 0
                          ? `${Math.min(100, (payrollDoneCount / payrollTotalEmployees) * 100)}%`
                          : "0%",
                    }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="rounded-md bg-muted p-2">
                    <div className="font-semibold text-sm">{payrollDoneCount}</div>
                    <div className="text-muted-foreground">Selesai</div>
                  </div>
                  <div className="rounded-md bg-muted p-2">
                    <div className="font-semibold text-sm">{payrollTotalEmployees - payrollDoneCount}</div>
                    <div className="text-muted-foreground">Belum</div>
                  </div>
                </div>

                {can(permissions, PERMISSIONS.PAYROLL_MANAGE) && payrollDoneCount < payrollTotalEmployees && (
                  <Button size="sm" asChild className="w-full">
                    <Link href="/dashboard/payroll">Hitung Sekarang</Link>
                  </Button>
                )}
                {payrollDoneCount >= payrollTotalEmployees && payrollTotalEmployees > 0 && (
                  <Badge className="justify-center py-1">✓ Semua karyawan selesai</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Currency Rates + Quick Links */}
      <div className="grid gap-6 @xl/main:grid-cols-3">
        {showStock && (
          <div className="@xl/main:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Kurs Mata Uang</CardTitle>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/dashboard/stockist">Lihat Semua →</Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {currencyStocks.length === 0 ? (
                  <div className="py-10 text-center text-muted-foreground text-sm px-6">
                    Belum ada data kurs mata uang. Tambahkan melalui menu{" "}
                    <Link href="/dashboard/stockist" className="underline">Stock Mata Uang</Link>.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cabang</TableHead>
                        <TableHead>Mata Uang</TableHead>
                        <TableHead className="text-right">Kurs Beli</TableHead>
                        <TableHead className="text-right">Kurs Jual</TableHead>
                        <TableHead className="text-right">Stok</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currencyStocks.map((cs) => (
                        <TableRow key={cs.id}>
                          <TableCell className="text-sm">{cs.branch?.name ?? "Tanpa Cabang"}</TableCell>
                          <TableCell><Badge variant="outline">{cs.currency.code}</Badge></TableCell>
                          <TableCell className="text-right font-mono text-sm">{fmtRate(cs.buyRate)}</TableCell>
                          <TableCell className="text-right font-mono text-sm">{fmtRate(cs.sellRate)}</TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {Number(cs.quantity).toLocaleString("id-ID")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Quick Navigation */}
        <div className={showStock ? "" : "@xl/main:col-span-3"}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Navigasi Cepat</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 pb-4">
              {quickLinks.map(({ href, label, icon: Icon }) => (
                <Button key={href} variant="outline" size="sm" asChild className="justify-start gap-2">
                  <Link href={href}>
                    <Icon className="size-4 shrink-0" />
                    {label}
                  </Link>
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Belum Absen + Kehadiran Hari Ini */}
      {showAttendanceAll && (
        <div className="grid gap-6 @xl/main:grid-cols-2">
          <Card className={notYetAbsent.length > 0 ? "border-yellow-300 dark:border-yellow-800" : ""}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <IconUserOff className="size-4 text-muted-foreground" />
                  <CardTitle className="text-base">Belum Absen Hari Ini</CardTitle>
                </div>
                {notYetAbsent.length > 0 && (
                  <Badge variant="outline" className="border-yellow-400 text-yellow-700 dark:text-yellow-400">
                    {notYetAbsent.length} karyawan
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {notYetAbsent.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground text-sm px-6">
                  <span className="text-green-600 font-medium">✓ Semua karyawan sudah absen</span>
                </div>
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
                        <TableCell className="text-sm text-muted-foreground">{u.branch?.name ?? "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Kehadiran Hari Ini</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/dashboard/attendance">Lihat →</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {todayAttendanceList.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground text-sm px-6">
                  Belum ada presensi hari ini
                </div>
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
                              att.status === "PRESENT" ? "default" : att.status === "LATE" ? "destructive" : "secondary"
                            }
                            className="text-xs"
                          >
                            {statusLabel[att.status] ?? att.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Bank Mutations + Bank Accounts */}
      {showBank && (
        <div className="grid gap-6 @xl/main:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Mutasi Bank Terbaru</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/dashboard/bank-accounts">Lihat →</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {recentMutations.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground text-sm px-6">Belum ada mutasi bank</div>
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
                            <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
                              <IconArrowUpRight className="size-3.5" />
                              Masuk
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-red-600 text-sm font-medium">
                              <IconArrowDownRight className="size-3.5" />
                              Keluar
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {fmtCurrency(mut.amount, mut.bankAccount.currency.code)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {mut.createdAt.toLocaleDateString("id-ID", { day: "2-digit", month: "short" })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Rekening Bank Aktif</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {activeBankAccountsCount} rekening{global ? " di semua PT" : ""}
                  </p>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/dashboard/bank-accounts">Kelola →</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {bankAccounts.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground text-sm px-6">Belum ada rekening bank aktif</div>
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
                        <TableCell><Badge variant="outline">{acc.currency.code}</Badge></TableCell>
                        <TableCell className="text-right font-mono text-sm font-semibold">
                          {fmtCurrency(acc.balance, acc.currency.code)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* KPI Monthly Results */}
      {showKpiAll && kpiResults.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Hasil KPI Bulan Ini</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Top performers — {now.toLocaleDateString("id-ID", { month: "long", year: "numeric" })}
                </p>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard/kpi/log">Lihat Log →</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Karyawan</TableHead>
                  <TableHead>Cabang</TableHead>
                  <TableHead className="text-right">Total Skor</TableHead>
                  <TableHead>Hasil Bonus</TableHead>
                  <TableHead className="text-right">Nominal Bonus</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {kpiResults.map((r, i) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-muted-foreground text-sm">{i + 1}</TableCell>
                    <TableCell className="font-medium text-sm">{r.employee.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.employee.branch?.name ?? "-"}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      {Number(r.totalScore).toFixed(1)}
                    </TableCell>
                    <TableCell>
                      {r.bonusResult && (
                        <Badge
                          variant={
                            r.bonusResult === "BONUS_CASH" || r.bonusResult === "TOP_PERFORMER" ? "default" : "secondary"
                          }
                          className="text-xs"
                        >
                          {bonusLabel[r.bonusResult] ?? r.bonusResult}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {r.bonusAmount != null ? fmtCurrency(r.bonusAmount) : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
