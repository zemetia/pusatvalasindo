"use client";

import * as React from "react";
import {
  IconBuilding,
  IconBuildingBank,
  IconCoin,
  IconDashboard,
  IconDatabase,
  IconListDetails,
  IconReport,
  IconSettings,
  IconUserCircle,
  IconUsers,
  IconId,
  IconTargetArrow,
  IconBrandTabler,
  IconFingerprint,
  IconPencil,
  IconWallet,
  IconClipboardCheck,
  IconGavel,
  IconChartCandle,
  IconChartHistogram,
  IconAdjustmentsHorizontal,
  IconReportMoney,
  type Icon,
} from "@tabler/icons-react";

import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { PERMISSIONS, can, isAdminRole, isGlobalRole } from "@/lib/permissions";

interface NavItem {
  title: string;
  url: string;
  icon?: Icon;
  exact?: boolean;
}

type SidebarUser = { name: string; email: string };

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user: SidebarUser;
  permissions: string[];
  roleName: string;
}

export function AppSidebar({ user, permissions, roleName, ...props }: AppSidebarProps) {
  if (!user) {
    throw new Error("AppSidebar requires a user but received undefined.");
  }

  const navMain: NavItem[] = [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: IconDashboard,
    },
  ];

  // ── Aktivitas Saya ────────────────────────────────────────────────────────
  const navSelf: NavItem[] = [];

  if (can(permissions, PERMISSIONS.ATTENDANCE_VIEW_OWN)) {
    navSelf.push({
      title: "Presensi",
      url: "/dashboard/attendance",
      icon: IconFingerprint,
    });
  }

  if (can(permissions, PERMISSIONS.KPI_FILL_OWN)) {
    navSelf.push({
      title: "Input KPI Saya",
      url: "/dashboard/kpi/self",
      icon: IconPencil,
    });
  }

  // ── KPI ────────────────────────────────────────────────────────────────────
  const navKPI: NavItem[] = [];

  if (can(permissions, PERMISSIONS.KPI_MANAGE)) {
    navKPI.push({
      title: "Konfigurasi",
      url: "/dashboard/kpi",
      icon: IconTargetArrow,
      exact: true,
    });
    navKPI.push({
      title: "Definisi KPI",
      url: "/dashboard/kpi/definitions",
      icon: IconListDetails,
    });
  }

  // Halaman ini juga tempat menyetujui entri yang diisi sendiri karyawan, jadi
  // atasan dengan KPI_APPROVE harus bisa masuk meski tidak punya KPI_VIEW_ALL.
  if (can(permissions, PERMISSIONS.KPI_VIEW_ALL) || can(permissions, PERMISSIONS.KPI_APPROVE)) {
    navKPI.push({
      title: "Penilaian & Persetujuan",
      url: "/dashboard/kpi/log",
      icon: IconReport,
    });
  }

  // ── Payroll ────────────────────────────────────────────────────────────────
  const navPayroll: NavItem[] = [];

  if (can(permissions, PERMISSIONS.PAYROLL_MANAGE)) {
    navPayroll.push({
      title: "Hitung Gaji",
      url: "/dashboard/payroll",
      icon: IconCoin,
    });
  }

  // ── Laporan (dashboard laporan/analisis untuk Karyawan/KPI, Finance, Watcher Valas) ──
  const navLaporan: NavItem[] = [];

  // Analisis Kinerja memeringkat karyawan lintas PT, jadi gerbangnya peran
  // global (Owner & Super Admin) — bukan permission KPI yang terikat satu PT.
  // Halaman ini menegakkan aturan yang sama lewat isGlobalRole.
  if (isGlobalRole(roleName)) {
    navLaporan.push({
      title: "Analisis Kinerja",
      url: "/dashboard/kpi/analisis",
      icon: IconChartHistogram,
    });
  }

  // Laporan Finance menyatukan posisi keuangan seluruh PT dalam satu layar,
  // jadi gerbangnya peran global (Owner & Super Admin) — sama seperti guard
  // requireGlobalPageCaller di halamannya. Kepala Cabang hanya berhak atas PT-nya.
  if (isGlobalRole(roleName)) {
    navLaporan.push({
      title: "Laporan Finance",
      url: "/dashboard/laporan-finance",
      icon: IconReportMoney,
    });
  }

  if (can(permissions, PERMISSIONS.STOCKIST_VIEW)) {
    navLaporan.push({
      title: "Watcher Valas",
      url: "/dashboard/watcher-valas",
      icon: IconChartCandle,
    });
  }

  // ── Finance Management ──────────────────────────────────────────────────
  const navFinanceManagement: NavItem[] = [];

  if (can(permissions, PERMISSIONS.BANK_VIEW)) {
    navFinanceManagement.push({
      title: "Rekening Bank",
      url: "/dashboard/bank-accounts",
      icon: IconBuildingBank,
    });
  }

  if (can(permissions, PERMISSIONS.COMPANY_STOCK_VIEW)) {
    navFinanceManagement.push({
      title: "Stock Management (PT)",
      url: "/dashboard/stock-management-pt",
      icon: IconDatabase,
    });
  }

  if (can(permissions, PERMISSIONS.CURRENCY_VIEW)) {
    navFinanceManagement.push({
      title: "Patokan Harga",
      url: "/dashboard/patokan-harga",
      icon: IconAdjustmentsHorizontal,
    });
  }

  // ── Finance Daily Input ──────────────────────────────────────────────────
  const navFinanceDailyInput: NavItem[] = [];

  if (can(permissions, PERMISSIONS.STOCKIST_VIEW)) {
    navFinanceDailyInput.push({
      title: "Stock & Kas",
      url: "/dashboard/stockist",
      icon: IconWallet,
    });
  }

  if (can(permissions, PERMISSIONS.BANK_VIEW)) {
    navFinanceDailyInput.push({
      title: "Saldo Bank Harian",
      url: "/dashboard/stockist/bank",
      icon: IconBuildingBank,
    });
  }

  if (can(permissions, PERMISSIONS.STOCKIST_VERIFY)) {
    navFinanceDailyInput.push({
      title: "Cross-Check Stock",
      url: "/dashboard/stockist/konfirmasi",
      icon: IconClipboardCheck,
    });
  }

  if (can(permissions, PERMISSIONS.CORRECTION_VIEW)) {
    navFinanceDailyInput.push({
      title: "Persetujuan Koreksi",
      url: "/dashboard/persetujuan-koreksi",
      icon: IconGavel,
    });
  }

  // ── Management ─────────────────────────────────────────────────────────────
  const navManagement: NavItem[] = [];

  // Pengguna hanya untuk Super Admin, Owner, dan Kepala Cabang (role-gated,
  // sejalan dengan guard di halaman /dashboard/users).
  if (isAdminRole(roleName)) {
    navManagement.push({
      title: "Pengguna",
      url: "/dashboard/users",
      icon: IconUsers,
    });
  }

  if (can(permissions, PERMISSIONS.BRANCHES_VIEW)) {
    navManagement.push({
      title: "Cabang",
      url: "/dashboard/branches",
      icon: IconBuilding,
    });
  }

  if (can(permissions, PERMISSIONS.ROLES_VIEW)) {
    navManagement.push({
      title: "Role & Akses",
      url: "/dashboard/roles",
      icon: IconId,
    });
  }

  // Account selalu tersedia
  navManagement.push({
    title: "Account",
    url: "/dashboard/account",
    icon: IconUserCircle,
  });

  const navSecondary: NavItem[] = [
    {
      title: "Setting",
      url: "/dashboard/setting",
      icon: IconSettings,
    },
  ];

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="h-(--header-height) justify-center border-b px-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="pointer-events-none h-auto py-1 select-none">
              <div className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                <IconBrandTabler className="size-5" />
              </div>
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate text-sm font-semibold tracking-tight">
                  Pusat Valas Indo
                </span>
                <span className="text-muted-foreground truncate text-xs">
                  Enterprise Suite
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
        {navSelf.length > 0 && <NavMain items={navSelf} label="Aktivitas Saya" />}
        {navKPI.length > 0 && <NavMain items={navKPI} label="KPI" />}
        {navPayroll.length > 0 && <NavMain items={navPayroll} label="Payroll" />}
        {navFinanceManagement.length > 0 && (
          <NavMain items={navFinanceManagement} label="Finance Management" />
        )}
        {navFinanceDailyInput.length > 0 && (
          <NavMain items={navFinanceDailyInput} label="Finance Daily Input" />
        )}
        {navLaporan.length > 0 && <NavMain items={navLaporan} label="Laporan" />}
        <NavMain items={navManagement} label="Management" />
        <div className="mt-auto">
          <NavMain items={navSecondary} label="System" />
        </div>
      </SidebarContent>
      <SidebarFooter className="border-t">
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
