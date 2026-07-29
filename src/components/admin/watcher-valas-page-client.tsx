"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  PageShell,
  PageHeader,
  SectionCard,
  EmptyState,
} from "@/components/admin/page-shell";
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

// Shows the value plus a change badge vs. the previous cron fetch — `prev`
// is null on a currency's first-ever fetch, so nothing to compare against yet.
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

  async function refresh() {
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

  // SmartDeal rates are DB-cached and refreshed by whatever external
  // scheduler hits src/app/api/scrape/smartdeal/route.ts, not scraped on
  // every request — so polling this endpoint every 30s is cheap and just
  // picks up whatever the last scrape wrote, giving a near-live view
  // without the user having to click Refresh. Ref avoids recreating the interval on every
  // render (refresh() closes over loading/data state that changes often).
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    const id = setInterval(() => refreshRef.current(), 30_000);
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
            <span className="text-muted-foreground hidden text-xs sm:inline">
              Kurs SmartDeal per{" "}
              {data.smartdealFetchedAt ? formatUpdatedAt(data.smartdealFetchedAt) : "—"} · halaman
              dicek {formatUpdatedAt(data.updatedAt)} (auto tiap 30 detik)
            </span>
            <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
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
                      <TableCell className="tabular text-right">
                        <RateCell value={r.smartdealBuy} prev={r.smartdealPrevBuy} />
                      </TableCell>
                      <TableCell className="tabular text-right">
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
