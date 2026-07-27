"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/admin/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { IconAdjustmentsHorizontal, IconCheck, IconDeviceFloppy, IconInfoCircle } from "@tabler/icons-react";
import { isValidPriceAdjustment } from "@/lib/price-adjustment";
import type { PriceBenchmarkRow } from "@/backend/services/price-benchmark.service";

interface PatokanHargaPageClientProps {
  initialRows: PriceBenchmarkRow[];
  canManage: boolean;
}

interface RowState {
  sellAdjustment: string;
  buyAdjustment: string;
  savedSellAdjustment: string;
  savedBuyAdjustment: string;
  saving: boolean;
  error: string | null;
}

export function PatokanHargaPageClient({ initialRows, canManage }: PatokanHargaPageClientProps) {
  const [rows, setRows] = useState<Record<string, RowState>>(() =>
    Object.fromEntries(
      initialRows.map((r) => [
        r.code,
        {
          sellAdjustment: r.sellAdjustment,
          buyAdjustment: r.buyAdjustment,
          savedSellAdjustment: r.sellAdjustment,
          savedBuyAdjustment: r.buyAdjustment,
          saving: false,
          error: null,
        },
      ])
    )
  );
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return initialRows;
    return initialRows.filter((r) => r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q));
  }, [initialRows, search]);

  function updateField(code: string, field: "sellAdjustment" | "buyAdjustment", value: string) {
    setRows((prev) => ({
      ...prev,
      [code]: { ...prev[code], [field]: value, error: null },
    }));
  }

  function isDirty(state: RowState) {
    return (
      state.sellAdjustment !== state.savedSellAdjustment ||
      state.buyAdjustment !== state.savedBuyAdjustment
    );
  }

  async function saveRow(code: string) {
    const state = rows[code];
    if (!state) return;

    if (!isValidPriceAdjustment(state.sellAdjustment) || !isValidPriceAdjustment(state.buyAdjustment)) {
      setRows((prev) => ({
        ...prev,
        [code]: { ...prev[code], error: "Format tidak valid" },
      }));
      return;
    }

    setRows((prev) => ({ ...prev, [code]: { ...prev[code], saving: true, error: null } }));
    try {
      const res = await fetch("/api/patokan-harga", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          sellAdjustment: state.sellAdjustment,
          buyAdjustment: state.buyAdjustment,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Gagal menyimpan");

      setRows((prev) => ({
        ...prev,
        [code]: {
          ...prev[code],
          saving: false,
          savedSellAdjustment: prev[code].sellAdjustment,
          savedBuyAdjustment: prev[code].buyAdjustment,
        },
      }));
    } catch (e) {
      setRows((prev) => ({
        ...prev,
        [code]: { ...prev[code], saving: false, error: e instanceof Error ? e.message : "Gagal menyimpan" },
      }));
    }
  }

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <PageHeader
        title="Patokan Harga"
        description="Aturan penyesuaian harga jual & beli Pusat Valas Indo di atas kurs SmartDeal."
        icon={<IconAdjustmentsHorizontal className="size-5" />}
      />

      <Alert>
        <IconInfoCircle className="size-4" />
        <AlertTitle>Format penyesuaian</AlertTitle>
        <AlertDescription>
          <code className="font-mono">+5</code> / <code className="font-mono">-10</code> = tambah/kurang nominal ·{" "}
          <code className="font-mono">c5</code> = bulatkan ke atas kelipatan 5 ·{" "}
          <code className="font-mono">f0.05</code> = bulatkan ke bawah kelipatan 0.05 ·{" "}
          <code className="font-mono">c0.1+5</code> = bulatkan ke atas kelipatan 0.1 lalu tambah 5. Kosongkan jika tidak ada penyesuaian.
        </AlertDescription>
      </Alert>

      <div className="flex flex-col gap-4">
        <Input
          type="search"
          placeholder="Cari kode atau nama mata uang..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mata Uang</TableHead>
                <TableHead>Penyesuaian Jual</TableHead>
                <TableHead>Penyesuaian Beli</TableHead>
                {canManage && <TableHead className="w-24" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canManage ? 4 : 3} className="text-center py-8 text-muted-foreground">
                    Tidak ada hasil untuk &ldquo;{search}&rdquo;
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r) => {
                  const state = rows[r.code];
                  const dirty = state ? isDirty(state) : false;
                  return (
                    <TableRow key={r.code}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono">{r.code}</Badge>
                          <span className="text-sm text-muted-foreground truncate">{r.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={state?.sellAdjustment ?? ""}
                          onChange={(e) => updateField(r.code, "sellAdjustment", e.target.value)}
                          placeholder="mis. +5"
                          disabled={!canManage}
                          className="max-w-32 font-mono"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={state?.buyAdjustment ?? ""}
                          onChange={(e) => updateField(r.code, "buyAdjustment", e.target.value)}
                          placeholder="mis. c5"
                          disabled={!canManage}
                          className="max-w-32 font-mono"
                        />
                      </TableCell>
                      {canManage && (
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant={dirty ? "default" : "ghost"}
                              disabled={!dirty || state?.saving}
                              onClick={() => saveRow(r.code)}
                            >
                              {state?.saving ? (
                                "..."
                              ) : dirty ? (
                                <IconDeviceFloppy className="size-4" />
                              ) : (
                                <IconCheck className="size-4 text-emerald-600" />
                              )}
                            </Button>
                          </div>
                          {state?.error && (
                            <p className="text-xs text-destructive mt-1">{state.error}</p>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
