// Dashboard untuk Kepala Cabang — sama komposisinya dengan dashboard Owner (fokus
// bisnis, tanpa presensi/KPI/gaji pribadi), tapi datanya dibatasi ke satu PT saja
// (companyId dari cabangnya), bukan lintas-PT.
import { PageShell, PageHeader, ErrorPanel } from "@/components/admin/page-shell";
import { IconDashboard } from "@tabler/icons-react";
import { CompanyOverviewSections } from "@/components/dashboard/company-overview-sections";
import {
  getDashboardPeriod,
  getCompanyOverview,
  buildCurrencyCards,
  buildBankGroups,
  computeBankTrend,
  roleLabel,
  type CompanyOverviewFlags,
} from "@/backend/services/dashboard-data.service";
import { can, PERMISSIONS } from "@/lib/permissions";
import { resolve, type AuthzSubject } from "@/lib/authz/resolve";
import type { AdminCaller } from "@/backend/helpers/get-admin-caller";

export async function DashboardKepalaCabang({
  caller,
  subject,
  userName,
}: {
  caller: AdminCaller;
  subject: AuthzSubject;
  userName: string;
}) {
  const { permissions, roleName, companyId, branchId } = caller;
  const { now, todayDate, currentMonth, currentYear, prevMonth, prevYear } = getDashboardPeriod();
  const hasCompanyScope = !!companyId;

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
    stock: can(permissions, PERMISSIONS.STOCK_VIEW) && !!companyId,
    bank: can(permissions, PERMISSIONS.BANK_VIEW) && hasCompanyScope,
  };
  const canApproveCorrections = can(permissions, PERMISSIONS.CORRECTION_APPROVE);
  const canManagePayroll = can(permissions, PERMISSIONS.PAYROLL_MANAGE);

  let overview;
  try {
    overview = await getCompanyOverview({
      flags,
      scope: { global: false, companyWide: true, companyId, branchId },
      todayDate,
      currentMonth,
      currentYear,
      prevMonth,
      prevYear,
      payrollCompanyIdList,
    });
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    return <ErrorPanel source="dashboard-kepala-cabang" message={msg} />;
  }

  const currencyCards = buildCurrencyCards(overview.currencyStocks, overview.prevRateMutations);
  const bankGroups = buildBankGroups(overview.bankAccounts, overview.dailyBankBalances);
  const primaryBankGroup = bankGroups.find((g) => g.code === "IDR") ?? bankGroups[0] ?? null;
  const bankTrendPct = computeBankTrend(overview.dailyBankBalances, primaryBankGroup);

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
