"use client";

import * as React from "react";
import {
  IconBuilding,
  IconCamera,
  IconCoin,
  IconDashboard,
  IconDatabase,
  IconFileAi,
  IconFileDescription,
  IconFileWord,
  IconFolder,
  IconHelp,
  IconInnerShadowTop,
  IconListDetails,
  IconReport,
  IconSearch,
  IconSettings,
  IconUserCircle,
  IconUsers,
  IconId,
  IconTargetArrow,
  IconBrandTabler,
  IconFingerprint,
} from "@tabler/icons-react";

import { NavDocuments } from "@/components/nav-documents";
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
} from "@/components/ui/sidebar";
import { user } from "@src/generated/prisma/client";

const data = {
  navMain: [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: IconDashboard,
    },
    {
      title: "Presensi",
      url: "/dashboard/attendance",
      icon: IconFingerprint,
    },
  ],
  navKPI: [
    {
      title: "Konfigurasi",
      url: "/dashboard/kpi",
      icon: IconTargetArrow,
      exact: true,
    },
    {
      title: "Definisi KPI",
      url: "/dashboard/kpi/definitions",
      icon: IconListDetails,
    },
    {
      title: "Log KPI",
      url: "/dashboard/kpi/log",
      icon: IconReport,
    },
  ],
  navPayroll: [
    {
      title: "Hitung Gaji",
      url: "/dashboard/payroll",
      icon: IconCoin,
    },
  ],
  navStock: [
    {
      title: "Stock Management",
      url: "/dashboard/stock-management",
      icon: IconDatabase,
    },
    {
      title: "Stok Harian",
      url: "/dashboard/stok-harian",
      icon: IconListDetails,
    },
  ],
  navManagement: [
    {
      title: "Pengguna",
      url: "/dashboard/users",
      icon: IconUsers,
    },
    {
      title: "Cabang",
      url: "/dashboard/branches",
      icon: IconBuilding,
    },
    {
      title: "Role & Akses",
      url: "/dashboard/roles",
      icon: IconId,
    },
    {
      title: "Account",
      url: "/dashboard/account",
      icon: IconUserCircle,
    },
  ],
  navSecondary: [
    {
      title: "Setting",
      url: "/dashboard/setting",
      icon: IconSettings,
    },
  ],
};

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user: user;
}

export function AppSidebar({ user, ...props }: AppSidebarProps) {
  if (!user) {
    throw new Error("AppSidebar requires a user but received undefined.");
  }
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="py-4 px-6">
        <div className="flex items-center gap-3">
          <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-lg">
            <IconBrandTabler className="size-5" />
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate font-display text-base font-bold tracking-tight text-premium">
              Pusat Valas Indo
            </span>
            <span className="truncate text-xs text-muted-foreground font-medium">
              Enterprise Suite
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavMain items={data.navKPI} label="KPI Management" />
        <NavMain items={data.navPayroll} label="Payroll" />
        <NavMain items={data.navStock} label="Inventory & Treasury" />
        <NavMain items={data.navManagement} label="Management" />
        <div className="mt-auto">
          <NavMain items={data.navSecondary} label="System" />
        </div>
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}
