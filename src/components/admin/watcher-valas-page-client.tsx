"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  PageShell,
  PageHeader,
  SectionCard,
  EmptyState,
} from "@/components/admin/page-shell";
import { cn } from "@/lib/utils";
import { SearchInput } from "@/components/admin/search-input";
import { TradingViewMiniChart } from "@/components/admin/tradingview-mini-chart";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  IconAlertTriangle,
  IconChartCandle,
  IconRefresh,
  IconTrendingUp,
  IconTrendingDown,
} from "@tabler/icons-react";

import type { WatcherValasData } from "@/backend/services/watcher-valas.service";

interface WatcherValasPageClientProps {
  initialData: WatcherValasData;
}

const idr = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 });

function formatUpdatedAt(iso: string) {
  return new Date(iso).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "medium",
  });
}

// Menampilkan nilai plus badge perubahan terhadap terbitan SmartDeal
// sebelumnya (jam "Kurs diperbarui" mereka), bukan terhadap refresh kita —
// `prev` null kalau kode ini belum punya pembanding.
function RateCell({ value, prev }: { value: number | null; prev: number | null }) {
  if (value == null) return <>—</>;
  if (prev == null || prev === value) {
    return <>{idr.format(value)}</>;
  }
  const up = value > prev;
  return (
    <span className="inline-flex items-center justify-end gap-1">
      {idr.format(value)}
      <span
        className={`inline-flex items-center gap-0.5 text-xs font-medium ${
          up ? "text-success" : "text-destructive"
        }`}
        title={`Sebelumnya ${idr.format(prev)}`}
      >
        {up ? <IconTrendingUp className="size-3.5" /> : <IconTrendingDown className="size-3.5" />}
        {idr.format(Math.abs(value - prev))}
      </span>
    </span>
  );
}

export function WatcherValasPageClient({ initialData }: WatcherValasPageClientProps) {
  const [data, setData] = useState(initialData);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data.rows;
    return data.rows.filter((r) => r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q));
  }, [data.rows, search]);

  async function poll() {
    setLoading(true);
    try {
      const res = await fetch("/api/watcher-valas", { cache: "no-store" });
      const json = await res.json();
      if (json.success) {
        setData(json.data as WatcherValasData);
      }
    } finally {
      setLoading(false);
    }
  }

  // The Refresh button forces a live SmartDeal scrape (not just a DB read) —
  // the whole point of pressing it is to see numbers actually change instead
  // of re-reading whatever the last cron/manual scrape happened to leave
  // cached. A failed scrape still comes back with fresh data (see the route),
  // so the "Down" badge updates instead of the button silently doing nothing.
  async function refreshAndScrape() {
    setLoading(true);
    try {
      const res = await fetch("/api/watcher-valas/scrape", { method: "POST", cache: "no-store" });
      const json = await res.json();
      if (json.success) {
        setData(json.data as WatcherValasData);
      }
    } finally {
      setLoading(false);
    }
  }

  // Passive poll every 30s picks up whatever the last scrape (cron or manual
  // Refresh click) wrote, without hitting smartdeal.co.id itself on every
  // tick. Ref avoids recreating the interval on every render (poll() closes
  // over loading/data state that changes often).
  const pollRef = useRef(poll);
  pollRef.current = poll;

  useEffect(() => {
    const id = setInterval(() => pollRef.current(), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <PageShell>
      <PageHeader
        title="Watcher Valas"
        description="Perbandingan kurs live SmartDeal (money changer) vs Yahoo Finance & ExchangeRate-API."
        icon={<IconChartCandle className="size-5" />}
        action={
          <>
            <Badge
              variant="outline"
              className={
                data.smartdealStatus.active
                  ? "border-success/40 text-success gap-1.5"
                  : "border-destructive/40 text-destructive gap-1.5"
              }
              title={data.smartdealStatus.lastError ?? undefined}
            >
              <span
                className={`size-1.5 rounded-full ${
                  data.smartdealStatus.active ? "bg-success" : "bg-destructive"
                }`}
              />
              SmartDeal {data.smartdealStatus.active ? "Aktif" : "Down"}
            </Badge>
            <span className="text-muted-foreground hidden text-xs sm:inline">
              Kurs diperbarui SmartDeal jam{" "}
              {data.smartdealStatus.sourceUpdatedAt
                ? formatUpdatedAt(data.smartdealStatus.sourceUpdatedAt)
                : "—"}{" "}
              · dicek {formatUpdatedAt(data.updatedAt)} (auto tiap 30 detik)
            </span>
            <Button variant="outline" size="sm" onClick={refreshAndScrape} disabled={loading}>
              <IconRefresh className={loading ? "size-4 animate-spin" : "size-4"} />
              Refresh
            </Button>
          </>
        }
      />

      {data.errors.length > 0 && (
        <Alert variant="destructive">
          <IconAlertTriangle className="size-4" />
          <AlertTitle>Sebagian sumber gagal dimuat</AlertTitle>
          <AlertDescription>
            {data.errors.map((e) => `${e.source}: ${e.message}`).join(" · ")}
          </AlertDescription>
        </Alert>
      )}

      <SectionCard
        padded={false}
        toolbar={
          <>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Cari kode atau nama mata uang..."
            />
            <span className="text-muted-foreground ml-auto text-xs">
              Klik baris untuk membuka grafik
            </span>
          </>
        }
      >
        <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mata Uang</TableHead>
                <TableHead className="text-right">SmartDeal Beli</TableHead>
                <TableHead className="text-right">SmartDeal Jual</TableHead>
                <TableHead className="text-right">Yahoo Finance</TableHead>
                <TableHead className="text-right">ExchangeRate-API</TableHead>
                <TableHead className="text-right">Selisih Jual vs Market</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="p-0">
                    <EmptyState
                      title="Tidak ada hasil"
                      description={`Tidak ada mata uang yang cocok dengan "${search}".`}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r) => {
                  // Yahoo Finance doesn't quote exotic pairs (e.g. AED, BHD,
                  // KWD vs IDR) — fall back to ExchangeRate-API for those.
                  const marketRate = r.yahooRate ?? r.exchangeRateApiRate;
                  const spread =
                    r.smartdealSell != null && marketRate != null
                      ? r.smartdealSell - marketRate
                      : null;
                  return (
                    <TableRow
                      key={r.code}
                      className="cursor-pointer"
                      data-state={selected === r.code ? "selected" : undefined}
                      onClick={() => setSelected(selected === r.code ? null : r.code)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono">
                            {r.code}
                          </Badge>
                          <span className="text-muted-foreground truncate">{r.name}</span>
                        </div>
                      </TableCell>
                      <TableCell
                        className={cn(
                          "tabular text-right",
                          r.smartdealBuy != null &&
                            r.smartdealPrevBuy != null &&
                            r.smartdealBuy !== r.smartdealPrevBuy &&
                            "bg-warning-muted"
                        )}
                      >
                        <RateCell value={r.smartdealBuy} prev={r.smartdealPrevBuy} />
                      </TableCell>
                      <TableCell
                        className={cn(
                          "tabular text-right",
                          r.smartdealSell != null &&
                            r.smartdealPrevSell != null &&
                            r.smartdealSell !== r.smartdealPrevSell &&
                            "bg-warning-muted"
                        )}
                      >
                        <RateCell value={r.smartdealSell} prev={r.smartdealPrevSell} />
                      </TableCell>
                      <TableCell className="tabular text-right">
                        {r.yahooRate != null ? idr.format(r.yahooRate) : "—"}
                      </TableCell>
                      <TableCell className="tabular text-right">
                        {r.exchangeRateApiRate != null ? idr.format(r.exchangeRateApiRate) : "—"}
                      </TableCell>
                      <TableCell className="tabular text-right font-medium">
                        {spread != null ? (
                          <span className={spread > 0 ? "text-destructive" : "text-success"}>
                            {spread > 0 ? "+" : ""}
                            {idr.format(spread)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
        </Table>
      </SectionCard>

      {selected && (
        <SectionCard title={`Grafik ${selected}/IDR`} padded={false}>
          <TradingViewMiniChart symbol={`FX_IDC:${selected}IDR`} />
        </SectionCard>
      )}
    </PageShell>
  );
}
