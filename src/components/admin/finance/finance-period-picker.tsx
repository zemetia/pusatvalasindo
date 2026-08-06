"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { PERIOD_PRESETS, type PeriodRange } from "@/lib/finance-period";
import { formatDate } from "@/lib/format";
import { IconCalendar, IconLoader2 } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

type Company = { id: string; name: string };

/**
 * Pemilih periode ala kalender POS: deretan preset (hari ini → tahun ini) plus
 * rentang custom, ditambah pemilih PT.
 *
 * Seluruh state hidup di URL (`?periode=&dari=&sampai=&pt=`), bukan di komponen:
 * halaman laporannya Server Component, jadi ganti periode = render ulang di
 * server tanpa endpoint tambahan, dan link periode tertentu bisa dibagikan apa
 * adanya ke owner lain.
 *
 * Isi input custom hanyalah draft lokal. Saat rentang berubah dari luar (klik
 * tanggal di kalender, tombol back browser), pemanggil me-remount komponen ini
 * lewat `key` berisi rentang aktif — jadi draft-nya ikut tereset tanpa perlu
 * menyalin prop ke state di dalam `useEffect`.
 */
export function FinancePeriodPicker({
  range,
  companies,
  activeCompanyId,
}: {
  range: PeriodRange;
  companies: Company[];
  /** `null` = seluruh PT. */
  activeCompanyId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const [showCustom, setShowCustom] = useState(range.preset === "custom");
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);

  const apply = (next: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }
    // Bulan kalender selalu mengikuti periode baru, jadi pilihan lama dibuang.
    params.delete("bulan");
    startTransition(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }));
  };

  return (
    <div className={cn("flex flex-col gap-3", pending && "opacity-60")}>
      <div className="flex flex-wrap items-center gap-2">
        <div
          role="tablist"
          aria-label="Periode laporan"
          className="bg-muted/60 inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-lg p-1"
        >
          {PERIOD_PRESETS.map((preset) => {
            // Sorotan menandai periode yang sedang *berlaku*, bukan yang sedang
            // disusun — panel tanggal yang muncul di bawah sudah jadi umpan balik
            // untuk klik "Custom".
            const active = preset.value === range.preset;
            return (
              <button
                key={preset.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  if (preset.value === "custom") {
                    setShowCustom(true);
                    return;
                  }
                  setShowCustom(false);
                  apply({ periode: preset.value, dari: null, sampai: null });
                }}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
                  active
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        {companies.length > 1 && (
          <Combobox
            value={activeCompanyId ?? "semua"}
            onValueChange={(value) => apply({ pt: value === "semua" ? null : value })}
            options={[
              { value: "semua", label: "Semua PT" },
              ...companies.map((company) => ({
                value: company.id,
                label: company.name,
              })),
            ]}
            searchPlaceholder="Cari PT..."
            aria-label="Filter PT"
            className="w-48"
          />
        )}

        <p className="text-muted-foreground ml-auto flex items-center gap-1.5 text-xs">
          {pending ? (
            <IconLoader2 className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <IconCalendar className="size-3.5" aria-hidden />
          )}
          <span className="tabular">
            {range.from === range.to
              ? formatDate(range.from)
              : `${formatDate(range.from)} – ${formatDate(range.to)}`}
          </span>
          <span aria-hidden>·</span>
          <span className="tabular">{range.days} hari</span>
        </p>
      </div>

      {showCustom && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1.5">
            <span className="text-muted-foreground text-xs font-medium">Dari</span>
            <Input
              type="date"
              value={from}
              max={to}
              onChange={(event) => setFrom(event.target.value)}
              className="h-9 w-44"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-muted-foreground text-xs font-medium">Sampai</span>
            <Input
              type="date"
              value={to}
              min={from}
              onChange={(event) => setTo(event.target.value)}
              className="h-9 w-44"
            />
          </label>
          <Button
            size="sm"
            variant="outline"
            disabled={!from || !to}
            onClick={() => apply({ periode: "custom", dari: from, sampai: to })}
          >
            Terapkan
          </Button>
        </div>
      )}
    </div>
  );
}
