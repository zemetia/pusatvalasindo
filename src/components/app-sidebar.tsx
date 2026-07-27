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
  IconAdjustmentsHorizontal,
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
import { PERMISSIONS, can, isAdminRole } from "@/lib/permissions";

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
      title: "Isi KPI Saya",
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

  if (can(permissions, PERMISSIONS.KPI_VIEW_ALL)) {
    navKPI.push({
      title: "Log KPI",
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

  // ── Bank & Treasury ──────────────────────────────────────────────────────
  const navBank: NavItem[] = [];

  if (can(permissions, PERMISSIONS.BANK_VIEW)) {
    navBank.push({
      title: "Rekening Bank",
      url: "/dashboard/bank-accounts",
      icon: IconBuildingBank,
    });
  }

  if (can(permissions, PERMISSIONS.BANK_VIEW)) {
    navBank.push({
      title: "Saldo Bank Harian",
      url: "/dashboard/stockist/bank",
      icon: IconBuildingBank,
    });
  }

  // ── Stock & Valas ────────────────────────────────────────────────────────
  const navStock: NavItem[] = [];

  if (can(permissions, PERMISSIONS.STOCKIST_VIEW)) {
    navStock.push({
      title: "Stock & Kas",
      url: "/dashboard/stockist",
      icon: IconWallet,
    });
  }

  if (can(permissions, PERMISSIONS.STOCKIST_VERIFY)) {
    navStock.push({
      title: "Cross-Check Stock",
      url: "/dashboard/stockist/konfirmasi",
      icon: IconClipboardCheck,
    });
  }

  if (can(permissions, PERMISSIONS.CORRECTION_VIEW)) {
    navStock.push({
      title: "Persetujuan Koreksi",
      url: "/dashboard/persetujuan-koreksi",
      icon: IconGavel,
    });
  }

  if (can(permissions, PERMISSIONS.COMPANY_STOCK_VIEW)) {
    navStock.push({
      title: "Stock Management (PT)",
      url: "/dashboard/stock-management-pt",
      icon: IconDatabase,
    });
  }

  if (can(permissions, PERMISSIONS.STOCKIST_VIEW)) {
    navStock.push({
      title: "Watcher Valas",
      url: "/dashboard/watcher-valas",
      icon: IconChartCandle,
    });
  }

  if (can(permissions, PERMISSIONS.CURRENCY_VIEW)) {
    navStock.push({
      title: "Patokan Harga",
      url: "/dashboard/patokan-harga",
      icon: IconAdjustmentsHorizontal,
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
      <SidebarHeader className="py-3 px-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="pointer-events-none select-none">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-lg">
                <IconBrandTabler className="size-5" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">Pusat Valas Indo</span>
                <span className="truncate text-xs text-muted-foreground">Enterprise Suite</span>
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
        {navBank.length > 0 && <NavMain items={navBank} label="Bank & Treasury" />}
        {navStock.length > 0 && <NavMain items={navStock} label="Stock & Valas" />}
        <NavMain items={navManagement} label="Management" />
        <div className="mt-auto">
          <NavMain items={navSecondary} label="System" />
        </div>
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
