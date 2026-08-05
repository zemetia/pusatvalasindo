// Dashboard untuk Owner & Super Admin — role manajemen global, tanpa presensi/KPI/
// gaji pribadi. Fokus penuh ke ringkasan bisnis: saldo bank, kurs, presensi &
// KPI tim, payroll tim, organisasi, mutasi bank — semuanya lintas-PT.
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

export async function DashboardOwner({
  caller,
  subject,
  userName,
}: {
  caller: AdminCaller;
  subject: AuthzSubject;
  userName: string;
}) {
  const { permissions, roleName } = caller;
  const { now, todayDate, currentMonth, currentYear, prevMonth, prevYear } = getDashboardPeriod();

  // Ringkasan gaji tim mengikuti matriks izin per-resource, bukan permission lama.
  const payrollManage = resolve(subject, "payroll.manage", "view");
  const payrollCompanyIdList = payrollManage.allowed ? (payrollManage.companyIds ?? undefined) : [];

  // Owner/Super Admin selalu melihat seluruh PT — flag di bawah tetap dicek lewat
  // `can()` (bukan diasumsikan true) supaya perilakunya konsisten kalau suatu saat
  // izin role ini dikustomisasi dari halaman Role & Akses.
  const flags: CompanyOverviewFlags = {
    suspicious: can(permissions, PERMISSIONS.ATTENDANCE_MANAGE),
    corrections: can(permissions, PERMISSIONS.CORRECTION_VIEW),
    usersCount: can(permissions, PERMISSIONS.USERS_VIEW),
    branchesCount: can(permissions, PERMISSIONS.BRANCHES_VIEW),
    attendanceAll: can(permissions, PERMISSIONS.ATTENDANCE_VIEW_ALL),
    kpiAll: can(permissions, PERMISSIONS.KPI_VIEW_ALL) || can(permissions, PERMISSIONS.KPI_MANAGE),
    payrollTeam: payrollManage.allowed,
    stock: can(permissions, PERMISSIONS.STOCK_VIEW),
    bank: can(permissions, PERMISSIONS.BANK_VIEW),
  };
  const canApproveCorrections = can(permissions, PERMISSIONS.CORRECTION_APPROVE);
  const canManagePayroll = can(permissions, PERMISSIONS.PAYROLL_MANAGE);

  let overview;
  try {
    overview = await getCompanyOverview({
      flags,
      scope: { global: true, companyWide: true, companyId: null, branchId: null },
      todayDate,
      currentMonth,
      currentYear,
      prevMonth,
      prevYear,
      payrollCompanyIdList,
    });
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    return <ErrorPanel source="dashboard-owner" message={msg} />;
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
        global
        now={now}
      />
    </PageShell>
  );
}
