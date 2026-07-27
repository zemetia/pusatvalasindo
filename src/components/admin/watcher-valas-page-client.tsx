"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/admin/page-header";
import { TradingViewMiniChart } from "@/components/admin/tradingview-mini-chart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  IconSearch,
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

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <PageHeader
        title="Watcher Valas"
        description="Perbandingan kurs live SmartDeal (money changer) vs Yahoo Finance & ExchangeRate-API."
        icon={<IconChartCandle className="size-5" />}
        action={
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <IconRefresh className={loading ? "size-4 animate-spin" : "size-4"} />
            Refresh
          </Button>
        }
      />

      <p className="text-xs text-muted-foreground -mt-4">
        Terakhir diperbarui: {formatUpdatedAt(data.updatedAt)}
      </p>

      {data.errors.length > 0 && (
        <Alert variant="destructive">
          <IconAlertTriangle className="size-4" />
          <AlertTitle>Sebagian sumber gagal dimuat</AlertTitle>
          <AlertDescription>
            {data.errors.map((e) => `${e.source}: ${e.message}`).join(" · ")}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-4">
        <div className="relative max-w-xs">
          <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            placeholder="Cari kode atau nama mata uang..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>

        <div className="rounded-md border">
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
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Tidak ada hasil untuk &ldquo;{search}&rdquo;
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
                          <Badge variant="outline" className="font-mono">{r.code}</Badge>
                          <span className="text-sm text-muted-foreground truncate">{r.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {r.smartdealBuy != null ? idr.format(r.smartdealBuy) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {r.smartdealSell != null ? idr.format(r.smartdealSell) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {r.yahooRate != null ? idr.format(r.yahooRate) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {r.exchangeRateApiRate != null ? idr.format(r.exchangeRateApiRate) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {spread != null ? (
                          <span className={spread > 0 ? "text-destructive" : "text-emerald-600"}>
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
        </div>

        {selected && (
          <TradingViewMiniChart symbol={`FX_IDC:${selected}IDR`} />
        )}
      </div>
    </div>
  );
}
