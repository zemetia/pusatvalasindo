"use client";

import { Menu, PanelLeft } from "lucide-react";
import { usePathname } from "@src/i18n/routing";
import { Separator } from "@/components/ui/separator";
import { useSidebar } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";
import { useIsMobile } from "@/hooks/use-mobile";
import { IconChevronRight } from "@tabler/icons-react";

function SidebarToggle() {
  const { toggleSidebar } = useSidebar();
  const isMobile = useIsMobile();

  return (
    <Button
      variant="ghost"
      size="icon"
      className="-ml-1 size-8"
      onClick={toggleSidebar}
      aria-label="Toggle Sidebar"
    >
      {isMobile ? <Menu className="size-5" /> : <PanelLeft className="size-4" />}
    </Button>
  );
}

/**
 * Label ruas URL → judul yang dibaca manusia. Ruas yang tidak terdaftar
 * (mis. UUID pada halaman detail) di-title-case seadanya.
 */
const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  account: "Account",
  attendance: "Presensi",
  "bank-accounts": "Rekening Bank",
  branches: "Cabang",
  employees: "Karyawan",
  items: "Item",
  konfirmasi: "Cross-Check Stock",
  kpi: "KPI",
  definitions: "Definisi KPI",
  log: "Log KPI",
  self: "Isi KPI Saya",
  bank: "Saldo Bank Harian",
  history: "Riwayat",
  label: "Label",
  "patokan-harga": "Patokan Harga",
  payroll: "Hitung Gaji",
  "persetujuan-koreksi": "Persetujuan Koreksi",
  register: "Registrasi",
  roles: "Role & Akses",
  setting: "Pengaturan",
  "stock-management-pt": "Stock Management (PT)",
  stockist: "Stock & Kas",
  users: "Pengguna",
  "watcher-valas": "Watcher Valas",
};

function labelFor(segment: string) {
  if (SEGMENT_LABELS[segment]) return SEGMENT_LABELS[segment];
  // Ruas dinamis (id) — tampilkan potongan pendek saja daripada UUID penuh.
  if (/^[0-9a-f-]{16,}$/i.test(segment)) return "Detail";
  return segment.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-sm">
      {segments.map((segment, i) => {
        const isLast = i === segments.length - 1;
        return (
          <span key={`${segment}-${i}`} className="flex min-w-0 items-center gap-1">
            {i > 0 && (
              <IconChevronRight className="text-muted-foreground/60 size-3.5 shrink-0" />
            )}
            <span
              className={
                isLast
                  ? "truncate font-medium"
                  : "text-muted-foreground hidden truncate sm:inline"
              }
            >
              {labelFor(segment)}
            </span>
          </span>
        );
      })}
    </nav>
  );
}

export function SiteHeader() {
  return (
    <header className="bg-background/80 sticky top-0 z-30 flex h-(--header-height) shrink-0 items-center border-b backdrop-blur-sm transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-2 px-4 lg:px-6">
        <SidebarToggle />
        <Separator
          orientation="vertical"
          className="mx-1 data-[orientation=vertical]:h-4"
        />
        <Breadcrumbs />
        <div className="ml-auto flex items-center gap-1">
          <ModeToggle />
        </div>
      </div>
    </header>
  );
}
