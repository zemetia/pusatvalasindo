// Dashboard untuk semua role selain Owner/Super Admin/Kepala Cabang (Kasir,
// Teller, HR, Akuntan, Marketing, Kurir, dst). Selalu menampilkan ringkasan
// pribadi (presensi/KPI/gaji hari ini & bulan ini); blok bisnis lintas-tim
// hanya muncul kalau role tersebut punya izin yang relevan (mis. HR punya
// KPI_MANAGE, Akuntan punya BANK_VIEW) — permission-driven, bukan role-driven,
// karena role di bucket ini sangat beragam izinnya.
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageShell, PageHeader, ErrorPanel, MetricRow, MetricBlock } from "@/components/admin/page-shell";
import { IconDashboard } from "@tabler/icons-react";
import { CompanyOverviewSections } from "@/components/dashboard/company-overview-sections";
import {
  getDashboardPeriod,
  getOwnSummary,
  getCompanyOverview,
  buildCurrencyCards,
  buildBankGroups,
  computeBankTrend,
  roleLabel,
  statusLabel,
  type CompanyOverviewFlags,
} from "@/backend/services/dashboard-data.service";
import { can, isAdminRole, PERMISSIONS } from "@/lib/permissions";
import { resolve, type AuthzSubject } from "@/lib/authz/resolve";
import type { AdminCaller } from "@/backend/helpers/get-admin-caller";

export async function DashboardPegawai({
  caller,
  subject,
  userName,
}: {
  caller: AdminCaller;
  subject: AuthzSubject;
  userName: string;
}) {
  const { permissions, roleName, companyId, branchId, id: userId } = caller;
  const { now, todayDate, currentMonth, currentYear, prevMonth, prevYear } = getDashboardPeriod();

  // Company-wide capable: dalam bucket ini praktis tidak ada (Kepala Cabang, satu-
  // satunya isAdminRole selain Owner/Super Admin, punya dashboard-nya sendiri) —
  // tapi dicek tetap lewat isAdminRole, bukan diasumsikan false, untuk jaga-jaga.
  const companyWide = isAdminRole(roleName);
  const hasCompanyScope = !!companyId;

  const showOwnAttendance = can(permissions, PERMISSIONS.ATTENDANCE_VIEW_OWN);
  const showOwnKpi = can(permissions, PERMISSIONS.KPI_VIEW_OWN);
  const showOwnPayroll = can(permissions, PERMISSIONS.PAYROLL_VIEW_OWN);

  const payrollManage = resolve(subject, "payroll.manage", "view");
  const payrollCompanyIdList = payrollManage.allowed ? (payrollManage.companyIds ?? undefined) : [];

  const flags: CompanyOverviewFlags = {
    suspicious: can(permissions, PERMISSIONS.ATTENDANCE_MANAGE) && hasCompanyScope,
    corrections: can(permissions, PERMISSIONS.CORRECTION_VIEW) && hasCompanyScope,
    usersCount: can(permissions, PERMISSIONS.USERS_VIEW) && hasCompanyScope,
    branchesCount: can(permissions, PERMISSIONS.BRANCHES_VIEW) && hasCompanyScope,
    attendanceAll: can(permissions, PERMISSIONS.ATTENDANCE_VIEW_ALL) && hasCompanyScope,
    kpiAll: (can(permissions, PERMISSIONS.KPI_VIEW_ALL) || can(permissions, PERMISSIONS.KPI_MANAGE)) && hasCompanyScope,
    payrollTeam: payrollManage.allowed,
    stock: can(permissions, PERMISSIONS.STOCK_VIEW) && (companyWide ? !!companyId : !!branchId),
    bank: can(permissions, PERMISSIONS.BANK_VIEW) && hasCompanyScope,
  };
  const canApproveCorrections = can(permissions, PERMISSIONS.CORRECTION_APPROVE);
  const canManagePayroll = can(permissions, PERMISSIONS.PAYROLL_MANAGE);
  const canFillOwnKpi = can(permissions, PERMISSIONS.KPI_FILL_OWN);

  let ownSummary;
  let overview;
  try {
    [ownSummary, overview] = await Promise.all([
      showOwnAttendance || showOwnKpi || showOwnPayroll
        ? getOwnSummary({ userId, month: currentMonth, year: currentYear, todayDate })
        : Promise.resolve(null),
      getCompanyOverview({
        flags,
        scope: { global: false, companyWide, companyId, branchId },
        todayDate,
        currentMonth,
        currentYear,
        prevMonth,
        prevYear,
        payrollCompanyIdList,
      }),
    ]);
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    return <ErrorPanel source="dashboard-pegawai" message={msg} />;
  }

  const currencyCards = buildCurrencyCards(overview.currencyStocks, overview.prevRateMutations);
  const bankGroups = buildBankGroups(overview.bankAccounts);
  const primaryBankGroup = bankGroups.find((g) => g.code === "IDR") ?? bankGroups[0] ?? null;
  const bankTrendPct = computeBankTrend(overview.dailyBankEntriesRaw, primaryBankGroup);

  return (
    <PageShell>
      <PageHeader
        title={`Halo, ${userName}`}
        description={`${roleLabel(roleName)} — ${now.toLocaleDateString("id-ID", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })}`}
        icon={<IconDashboard className="size-5" />}
      />

      {/* Ringkasan Saya — blok data editorial, tanpa kartu */}
      {ownSummary && (showOwnAttendance || showOwnKpi || showOwnPayroll) && (
        <MetricRow title="Ringkasan Saya" columns={3}>
          {showOwnAttendance && (
            <MetricBlock
              label="Presensi Saya Hari Ini"
              size="secondary"
              tone={ownSummary.ownAttendanceToday ? "default" : "muted"}
              value={
                ownSummary.ownAttendanceToday?.checkIn
                  ? ownSummary.ownAttendanceToday.checkIn.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
                  : "—"
              }
              meta={
                ownSummary.ownAttendanceToday ? (
                  <Badge
                    variant={
                      ownSummary.ownAttendanceToday.status === "PRESENT"
                        ? "success"
                        : ownSummary.ownAttendanceToday.status === "LATE"
                          ? "warning"
                          : "soft"
                    }
                  >
                    {statusLabel[ownSummary.ownAttendanceToday.status] ?? ownSummary.ownAttendanceToday.status}
                  </Badge>
                ) : (
                  "Belum absen hari ini"
                )
              }
              action={
                !ownSummary.ownAttendanceToday && (
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
              tone={ownSummary.ownKpiThisMonth ? "default" : "muted"}
              value={ownSummary.ownKpiThisMonth ? `${(Number(ownSummary.ownKpiThisMonth.totalScore) * 100).toFixed(1)}%` : "—"}
              meta={
                ownSummary.ownKpiThisMonth ? (
                  <Badge variant="soft">Grade {ownSummary.ownKpiThisMonth.grade}</Badge>
                ) : (
                  `${ownSummary.ownKpiLogsThisMonth} entri KPI tercatat bulan ini`
                )
              }
              action={
                !ownSummary.ownKpiThisMonth &&
                canFillOwnKpi && (
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
              tone={ownSummary.ownKpiThisMonth ? "default" : "muted"}
              value={ownSummary.ownKpiThisMonth ? `Grade ${ownSummary.ownKpiThisMonth.grade}` : "—"}
              meta={
                ownSummary.ownKpiThisMonth
                  ? `Bonus/potongan ${now.toLocaleDateString("id-ID", { month: "long", year: "numeric" })} dihitung saat slip gaji dibuat`
                  : "KPI bulan ini belum dihitung"
              }
            />
          )}
        </MetricRow>
      )}

      <CompanyOverviewSections
        flags={flags}
        overview={overview}
        currencyCards={currencyCards}
        bankGroups={bankGroups}
        primaryBankGroup={primaryBankGroup}
        bankTrendPct={bankTrendPct}
        canApproveCorrections={canApproveCorrections}
        canManagePayroll={canManagePayroll}
        global={false}
        now={now}
      />
    </PageShell>
  );
}
