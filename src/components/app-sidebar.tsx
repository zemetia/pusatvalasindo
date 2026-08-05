"use client";

import * as React from "react";
import {
  IconBuilding,
  IconBuildingBank,
  IconBuildingSkyscraper,
  IconCoin,
  IconDashboard,
  IconDatabase,
  IconListDetails,
  IconReport,
  IconScale,
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
  IconClockDollar,
  IconGavel,
  IconChartCandle,
  IconChartHistogram,
  IconAdjustmentsHorizontal,
  IconReportMoney,
  IconCurrencyDollar,
  IconCoins,
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
import { allows, type AuthzSubject } from "@/lib/authz/resolve";

interface NavItem {
  title: string;
  url: string;
  icon?: Icon;
  exact?: boolean;
}

type SidebarUser = { name: string; email: string };

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user: SidebarUser;
  /**
   * Subjek izin pemanggil. Sidebar memakai resource registry yang SAMA dengan
   * page guard dan API guard, jadi menu yang tampil tidak bisa melenceng dari
   * halaman yang benar-benar boleh dibuka.
   */
  subject: AuthzSubject;
  /**
   * User tanpa cabang tidak punya tempat presensi maupun periode KPI sendiri,
   * jadi section "Aktivitas Saya" disembunyikan untuk mereka.
   */
  hasBranch: boolean;
}

export function AppSidebar({ user, subject, hasBranch, ...props }: AppSidebarProps) {
  if (!user) {
    throw new Error("AppSidebar requires a user but received undefined.");
  }

  /** Tampil kalau jabatan ini boleh membuka resource-nya, apa pun PT-nya. */
  const show = (resource: string, action: "view" | "write" = "view") =>
    allows(subject, resource, action);

  const navMain: NavItem[] = [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: IconDashboard,
    },
  ];

  // ── Aktivitas Saya ────────────────────────────────────────────────────────
  const navSelf: NavItem[] = [];

  if (hasBranch && show("attendance.self")) {
    navSelf.push({
      title: "Presensi",
      url: "/dashboard/attendance",
      icon: IconFingerprint,
    });
  }

  if (hasBranch && show("kpi.self")) {
    navSelf.push({
      title: "Input KPI Saya",
      url: "/dashboard/kpi/self",
      icon: IconPencil,
    });
  }

  // ── KPI ────────────────────────────────────────────────────────────────────
  const navKPI: NavItem[] = [];

  // Presensi karyawan duduk di section KPI karena kedisiplinan kehadiran adalah
  // salah satu sumber skor KPI — koreksinya dilakukan orang yang sama.
  if (show("attendance.all") || show("attendance.all", "write")) {
    navKPI.push({
      title: "Presensi Karyawan",
      url: "/dashboard/kpi/presensi",
      icon: IconFingerprint,
    });
  }

  if (show("kpi.config")) {
    navKPI.push({
      title: "Konfigurasi",
      url: "/dashboard/kpi",
      icon: IconTargetArrow,
      exact: true,
    });
  }

  // Resource tersendiri: Definisi KPI adalah daftar induk indikator, bisa
  // didelegasikan tanpa ikut memberi akses ke bobot per jabatan.
  if (show("kpi.definitions")) {
    navKPI.push({
      title: "Definisi KPI",
      url: "/dashboard/kpi/definitions",
      icon: IconListDetails,
    });
  }

  // Halaman ini juga tempat menyetujui entri yang diisi sendiri karyawan, jadi
  // atasan dengan KPI_APPROVE harus bisa masuk meski tidak punya KPI_VIEW_ALL.
  if (show("kpi.review") || show("kpi.review", "write")) {
    navKPI.push({
      title: "Penilaian & Persetujuan",
      url: "/dashboard/kpi/log",
      icon: IconReport,
    });
  }

  // ── Payroll ────────────────────────────────────────────────────────────────
  const navPayroll: NavItem[] = [];

  if (show("payroll.manage", "write")) {
    navPayroll.push({
      title: "Hitung Gaji",
      url: "/dashboard/payroll",
      icon: IconCoin,
    });
  }

  if (show("payroll.components", "view")) {
    navPayroll.push({
      title: "Komponen Gaji",
      url: "/dashboard/payroll/komponen",
      icon: IconListDetails,
    });
  }

  if (show("payroll.rules", "view")) {
    navPayroll.push({
      title: "Rule Reward & Denda",
      url: "/dashboard/payroll/rules",
      icon: IconScale,
    });
  }

  // ── Laporan (dashboard laporan/analisis untuk Karyawan/KPI, Finance, Watcher Valas) ──
  const navLaporan: NavItem[] = [];

  // Seluruh item di section ini adalah resource `scoping: "global"`: isinya
  // laporan lintas PT, jadi izinnya tidak punya dimensi PT — hanya boleh atau
  // tidak. Default-nya Owner & Super Admin, dan hanya mereka yang boleh
  // mendelegasikannya lewat matriks izin.
  if (show("kpi.analytics")) {
    navLaporan.push({
      title: "Analisis Kinerja",
      url: "/dashboard/kpi/analisis",
      icon: IconChartHistogram,
    });
  }

  if (show("finance.report")) {
    navLaporan.push({
      title: "Laporan Finance",
      url: "/dashboard/laporan-finance",
      icon: IconReportMoney,
    });
  }

  if (show("watcher.valas")) {
    navLaporan.push({
      title: "Watcher Valas",
      url: "/dashboard/watcher-valas",
      icon: IconChartCandle,
    });
  }

  // ── Finance Management ──────────────────────────────────────────────────
  const navFinanceManagement: NavItem[] = [];

  if (show("bank.accounts")) {
    navFinanceManagement.push({
      title: "Rekening Bank",
      url: "/dashboard/bank-accounts",
      icon: IconBuildingBank,
    });
  }

  if (show("stock.pt")) {
    navFinanceManagement.push({
      title: "Stock Management (PT)",
      url: "/dashboard/stock-management-pt",
      icon: IconDatabase,
    });
  }

  if (show("price.benchmark")) {
    navFinanceManagement.push({
      title: "Patokan Harga",
      url: "/dashboard/patokan-harga",
      icon: IconAdjustmentsHorizontal,
    });
  }

  // Harga Valas adalah harga final yang benar-benar dipakai (diisi manual),
  // sedangkan Patokan Harga di atas hanya menyimpan aturan penyesuaiannya.
  if (show("currency.price")) {
    navFinanceManagement.push({
      title: "Harga Valas",
      url: "/dashboard/harga-valas",
      icon: IconCurrencyDollar,
    });
  }

  if (show("currency")) {
    navFinanceManagement.push({
      title: "Mata Uang",
      url: "/dashboard/mata-uang",
      icon: IconCoins,
    });
  }

  // ── Finance Daily Input ──────────────────────────────────────────────────
  const navFinanceDailyInput: NavItem[] = [];

  if (show("stockist.daily")) {
    navFinanceDailyInput.push({
      title: "Stock & Kas",
      url: "/dashboard/stockist",
      icon: IconWallet,
    });
  }

  if (show("bank.daily")) {
    navFinanceDailyInput.push({
      title: "Saldo Bank Harian",
      url: "/dashboard/stockist/bank",
      icon: IconBuildingBank,
    });
  }

  // Dana Tertahan duduk di section input harian karena polanya sama: dibuka per
  // tanggal dan diisi hari itu. Bedanya barisnya bertahan sampai dinyatakan lunas.
  if (show("finance.receivable")) {
    navFinanceDailyInput.push({
      title: "Dana Tertahan",
      url: "/dashboard/hutang",
      icon: IconClockDollar,
    });
  }

  if (show("stockist.verify")) {
    navFinanceDailyInput.push({
      title: "Cross-Check Stock",
      url: "/dashboard/stockist/konfirmasi",
      icon: IconClipboardCheck,
    });
  }

  if (show("correction")) {
    navFinanceDailyInput.push({
      title: "Persetujuan Koreksi",
      url: "/dashboard/persetujuan-koreksi",
      icon: IconGavel,
    });
  }

  // ── Management ─────────────────────────────────────────────────────────────
  const navManagement: NavItem[] = [];

  if (show("users")) {
    navManagement.push({
      title: "Pengguna",
      url: "/dashboard/users",
      icon: IconUsers,
    });
  }

  if (show("companies")) {
    navManagement.push({
      title: "PT",
      url: "/dashboard/pt",
      icon: IconBuildingSkyscraper,
    });
  }

  if (show("branches")) {
    navManagement.push({
      title: "Cabang",
      url: "/dashboard/branches",
      icon: IconBuilding,
    });
  }

  if (show("roles")) {
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
