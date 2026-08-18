"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  PageShell,
  PageHeader,
  SectionCard,
  EmptyState,
} from "@/components/admin/page-shell";
import { SearchInput } from "@/components/admin/search-input";
import { Input } from "@/components/ui/input";
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
import {
  IconAdjustmentsHorizontal,
  IconAlertTriangle,
  IconArrowRight,
  IconCheck,
  IconInfoCircle,
  IconLoader2,
  IconMinus,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isValidPriceAdjustment } from "@/lib/price-adjustment";
import type { PriceBenchmarkRow } from "@/backend/services/price-benchmark.service";

interface PatokanHargaPageClientProps {
  initialRows: PriceBenchmarkRow[];
  canManage: boolean;
  /**
   * Boleh mendorong hasil aturan ini ke Harga Valas. Gerbangnya izin TULIS
   * Harga Valas — yang berubah angkanya di sana, bukan di halaman ini.
   */
  canPushToPrices?: boolean;
}

type SaveState = "idle" | "saving" | "saved" | "error";

interface RowState {
  sellAdjustment: string;
  buyAdjustment: string;
  savedSellAdjustment: string;
  savedBuyAdjustment: string;
  saveState: SaveState;
  updatedAt: string | null;
  error: string | null;
}

// Timezone dikunci supaya render server & client menghasilkan string yang sama
// (kalau tidak, hydration-nya mismatch di mesin dengan TZ berbeda).
const dateTimeFmt = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

function formatUpdatedAt(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return dateTimeFmt.format(d);
}

export function PatokanHargaPageClient({
  initialRows,
  canManage,
  canPushToPrices = false,
}: PatokanHargaPageClientProps) {
  const [rows, setRows] = useState<Record<string, RowState>>(() =>
    Object.fromEntries(
      initialRows.map((r) => [
        r.code,
        {
          sellAdjustment: r.sellAdjustment,
          buyAdjustment: r.buyAdjustment,
          savedSellAdjustment: r.sellAdjustment,
          savedBuyAdjustment: r.buyAdjustment,
          saveState: "idle" as SaveState,
          updatedAt: r.updatedAt,
          error: null,
        },
      ])
    )
  );
  const [search, setSearch] = useState("");
  const [pushing, setPushing] = useState(false);

  /**
   * Mendorong aturan di halaman ini ke Harga Valas. Route-nya sama persis
   * dengan tombol "Sync sekarang" di sana — satu operasi, dua pintu masuk.
   */
  async function pushToPrices() {
    setPushing(true);
    try {
      const res = await fetch("/api/harga-valas/sync", { method: "POST" });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Gagal menerapkan");
      toast.success(`Harga Valas diperbarui — ${json.data.summary}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menerapkan");
    } finally {
      setPushing(false);
    }
  }

  // Blur-save membaca state terbaru, bukan snapshot dari render saat handler dibuat.
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

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

  async function saveRow(code: string) {
    const state = rowsRef.current[code];
    if (!state || !canManage) return;
    // Tidak ada perubahan sejak simpan terakhir — jangan panggil API.
    if (
      state.sellAdjustment === state.savedSellAdjustment &&
      state.buyAdjustment === state.savedBuyAdjustment
    ) {
      return;
    }

    if (!isValidPriceAdjustment(state.sellAdjustment) || !isValidPriceAdjustment(state.buyAdjustment)) {
      setRows((prev) => ({
        ...prev,
        [code]: { ...prev[code], saveState: "error", error: "Format tidak valid" },
      }));
      return;
    }

    setRows((prev) => ({ ...prev, [code]: { ...prev[code], saveState: "saving", error: null } }));
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
      if (!res.ok || !json.success) throw new Error(json.message ?? json.error ?? "Gagal menyimpan");

      setRows((prev) => ({
        ...prev,
        [code]: {
          ...prev[code],
          saveState: "saved",
          savedSellAdjustment: state.sellAdjustment,
          savedBuyAdjustment: state.buyAdjustment,
          updatedAt: json.data?.updatedAt ?? new Date().toISOString(),
          error: null,
        },
      }));
    } catch (e) {
      const message = e instanceof Error ? e.message : "Gagal menyimpan";
      toast.error(`${code}: ${message}`);
      setRows((prev) => ({
        ...prev,
        [code]: { ...prev[code], saveState: "error", error: message },
      }));
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Patokan Harga"
        description="Aturan penyesuaian harga beli & jual Pusat Valas Indo di atas kurs SmartDeal."
        icon={<IconAdjustmentsHorizontal className="size-5" />}
        action={
          canPushToPrices && (
            <Button size="sm" onClick={pushToPrices} disabled={pushing}>
              {pushing ? (
                <IconLoader2 className="size-4 animate-spin" />
              ) : (
                <IconArrowRight className="size-4" />
              )}
              {pushing ? "Menerapkan..." : "Terapkan ke Harga Valas"}
            </Button>
          )
        }
      />

      <Alert>
        <IconInfoCircle className="size-4" />
        <AlertTitle>Format penyesuaian</AlertTitle>
        <AlertDescription className="w-full">
          <dl className="mt-1 grid w-full grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
            <div className="flex items-center gap-2.5">
              <dt>
                <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">+5</code>{" "}
                <span className="text-muted-foreground">/</span>{" "}
                <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">-10</code>
              </dt>
              <dd className="text-muted-foreground">tambah/kurang nominal</dd>
            </div>
            <div className="flex items-center gap-2.5">
              <dt>
                <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">c5</code>
              </dt>
              <dd className="text-muted-foreground">bulatkan ke atas kelipatan 5</dd>
            </div>
            <div className="flex items-center gap-2.5">
              <dt>
                <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">f0.05</code>
              </dt>
              <dd className="text-muted-foreground">bulatkan ke bawah kelipatan 0.05</dd>
            </div>
            <div className="flex items-center gap-2.5">
              <dt>
                <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">c0.1+5</code>
              </dt>
              <dd className="text-muted-foreground">bulatkan ke atas kelipatan 0.1 lalu tambah 5</dd>
            </div>
          </dl>
          <p className="text-muted-foreground mt-2 text-xs italic">Kosongkan jika tidak ada penyesuaian.</p>
        </AlertDescription>
      </Alert>

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
              {canManage && "Perubahan tersimpan otomatis saat keluar dari kolom · "}
              {filtered.length} dari {initialRows.length} mata uang
            </span>
          </>
        }
      >
        <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mata Uang</TableHead>
                <TableHead>Penyesuaian Beli</TableHead>
                <TableHead>Penyesuaian Jual</TableHead>
                <TableHead className="w-56">Terakhir Diubah</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={4} className="p-0">
                    <EmptyState
                      title="Tidak ada hasil"
                      description={`Tidak ada mata uang yang cocok dengan "${search}".`}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r) => {
                  const state = rows[r.code];
                  return (
                    <TableRow key={r.code}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono">
                            {r.code}
                          </Badge>
                          <span className="text-muted-foreground truncate">{r.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={state?.buyAdjustment ?? ""}
                          onChange={(e) => updateField(r.code, "buyAdjustment", e.target.value)}
                          onBlur={() => saveRow(r.code)}
                          placeholder="mis. c5"
                          disabled={!canManage}
                          className={cn(
                            "h-8 max-w-32 font-mono",
                            state?.error && "border-destructive"
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={state?.sellAdjustment ?? ""}
                          onChange={(e) => updateField(r.code, "sellAdjustment", e.target.value)}
                          onBlur={() => saveRow(r.code)}
                          placeholder="mis. +5"
                          disabled={!canManage}
                          className={cn(
                            "h-8 max-w-32 font-mono",
                            state?.error && "border-destructive"
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <SaveStatus
                          state={state?.saveState ?? "idle"}
                          updatedAt={state?.updatedAt ?? null}
                          error={state?.error ?? null}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
        </Table>
      </SectionCard>
    </PageShell>
  );
}

function SaveStatus({
  state,
  updatedAt,
  error,
}: {
  state: SaveState;
  updatedAt: string | null;
  error: string | null;
}) {
  const stamp = formatUpdatedAt(updatedAt);

  if (state === "saving") {
    return (
      <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <IconLoader2 className="size-3.5 animate-spin" />
        Menyimpan...
      </span>
    );
  }

  if (state === "error") {
    return (
      <span className="text-destructive flex items-center gap-1.5 text-xs">
        <IconAlertTriangle className="size-3.5" />
        {error ?? "Gagal menyimpan"}
      </span>
    );
  }

  if (state === "saved") {
    return (
      <span className="text-success flex items-center gap-1.5 text-xs">
        <IconCheck className="size-3.5" />
        Tersimpan{stamp ? ` · ${stamp}` : ""}
      </span>
    );
  }

  if (!stamp) {
    return (
      <span className="text-muted-foreground/50 flex items-center gap-1.5 text-xs">
        <IconMinus className="size-3.5" />
        Belum pernah diubah
      </span>
    );
  }

  return <span className="text-muted-foreground text-xs">{stamp}</span>;
}
