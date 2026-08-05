"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  IconCheck,
  IconCoins,
  IconCurrencyDollar,
  IconDeviceFloppy,
  IconLock,
  IconLockOpen,
  IconRefresh,
  IconSettings,
} from "@tabler/icons-react";
import {
  PageShell,
  PageHeader,
  SectionCard,
  EmptyState,
  MetricRow,
  MetricBlock,
} from "@/components/admin/page-shell";
import { SearchInput } from "@/components/admin/search-input";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EM_DASH, formatRate } from "@/lib/format";
import type { CurrencyPriceRow } from "@/backend/services/currency-price.service";
import type { SyncResult } from "@/backend/services/currency-price-sync.service";

export interface SyncSetting {
  autoSync: boolean;
  lastRunAt: string | null;
  lastRunSummary: string | null;
}

interface HargaValasPageClientProps {
  initialRows: CurrencyPriceRow[];
  initialSetting: SyncSetting;
  canManage: boolean;
  /** Halaman master mata uang, sudah berprefix locale. */
  currencyPageHref: string | null;
  /** Halaman Patokan Harga — hulu dari harga di sini. */
  benchmarkPageHref: string | null;
}

interface RowState {
  buyPrice: string;
  sellPrice: string;
  savedBuyPrice: string;
  savedSellPrice: string;
  spread: number | null;
  source: CurrencyPriceRow["source"];
  isLocked: boolean;
  updatedAt: string | null;
  saving: boolean;
  locking: boolean;
  error: string | null;
}

/** Angka mentah → tampilan Indonesia (`16250.5` → `16.250,5`). */
function toInput(value: number | null): string {
  if (value == null) return "";
  const [intPart, decPart] = String(value).split(".");
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return decPart ? `${withThousands},${decPart}` : withThousands;
}

/**
 * Isi input mentah dari pengguna → tampilan berpemisah ribu, dievaluasi
 * ulang setiap ketukan supaya "." muncul otomatis sambil mengetik.
 */
function formatThousands(raw: string): string {
  const cleaned = raw.replace(/[^0-9,]/g, "");
  const commaIndex = cleaned.indexOf(",");
  const intPart = commaIndex >= 0 ? cleaned.slice(0, commaIndex) : cleaned;
  const decPart = commaIndex >= 0 ? cleaned.slice(commaIndex + 1).replace(/,/g, "") : null;
  const withThousands = intPart
    .replace(/^0+(?=\d)/, "")
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return decPart !== null ? `${withThousands},${decPart}` : withThousands;
}

/**
 * Isi input → angka. Menerima gaya Indonesia (`16.250,50`) maupun gaya polos
 * (`16250.5`): pemisah ribuan dibuang, koma jadi titik desimal.
 */
function parseAmount(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const normalized = trimmed.includes(",")
    ? trimmed.replace(/\./g, "").replace(",", ".")
    : trimmed.replace(/\.(?=\d{3}(\D|$))/g, "");
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function toRowState(row: CurrencyPriceRow, previous?: RowState): RowState {
  return {
    buyPrice: toInput(row.buyPrice),
    sellPrice: toInput(row.sellPrice),
    savedBuyPrice: toInput(row.buyPrice),
    savedSellPrice: toInput(row.sellPrice),
    spread: row.spread,
    source: row.source,
    isLocked: row.isLocked,
    updatedAt: row.updatedAt,
    saving: false,
    locking: false,
    error: previous?.error ?? null,
  };
}

function formatDateTime(iso: string | null): string {
  if (!iso) return EM_DASH;
  return new Date(iso).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function HargaValasPageClient({
  initialRows,
  initialSetting,
  canManage,
  currencyPageHref,
  benchmarkPageHref,
}: HargaValasPageClientProps) {
  const [rows, setRows] = useState<Record<string, RowState>>(() =>
    Object.fromEntries(initialRows.map((r) => [r.currencyId, toRowState(r)]))
  );
  const [setting, setSetting] = useState<SyncSetting>(initialSetting);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");

  // Mata uang nonaktif tidak lagi dipakai untuk transaksi — sembunyikan dari
  // halaman ini sepenuhnya, jangan cuma diredupkan.
  const activeRows = useMemo(() => initialRows.filter((r) => r.isActive), [initialRows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return activeRows;
    return activeRows.filter(
      (r) => r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q)
    );
  }, [activeRows, search]);

  // Ringkasan dihitung dari state, bukan dari `activeRows`, supaya angkanya
  // ikut bergerak begitu satu baris disimpan atau sync jalan — tanpa reload.
  const summary = useMemo(() => {
    const states = activeRows.map((r) => rows[r.currencyId]).filter(Boolean);
    const priced = states.filter((s) => s.savedBuyPrice !== "" && s.savedSellPrice !== "");
    const spreads = priced.map((s) => s.spread).filter((v): v is number => v != null);

    return {
      total: activeRows.length,
      priced: priced.length,
      locked: states.filter((s) => s.isLocked).length,
      avgSpread: spreads.length ? spreads.reduce((a, b) => a + b, 0) / spreads.length : null,
    };
  }, [activeRows, rows]);

  function updateField(id: string, field: "buyPrice" | "sellPrice", value: string) {
    const formatted = formatThousands(value);
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], [field]: formatted, error: null } }));
  }

  function isDirty(state: RowState) {
    return state.buyPrice !== state.savedBuyPrice || state.sellPrice !== state.savedSellPrice;
  }

  function setError(id: string, message: string) {
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], saving: false, error: message } }));
  }

  async function saveRow(id: string) {
    const state = rows[id];
    if (!state) return;

    const buyPrice = parseAmount(state.buyPrice);
    const sellPrice = parseAmount(state.sellPrice);

    if (buyPrice == null || sellPrice == null) {
      setError(id, "Harga beli dan jual wajib diisi");
      return;
    }
    if (buyPrice < 0 || sellPrice < 0) {
      setError(id, "Harga tidak boleh negatif");
      return;
    }
    if (sellPrice < buyPrice) {
      setError(id, "Harga jual tidak boleh lebih rendah dari harga beli");
      return;
    }

    setRows((prev) => ({ ...prev, [id]: { ...prev[id], saving: true, error: null } }));
    try {
      const res = await fetch("/api/harga-valas", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currencyId: id, buyPrice, sellPrice }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Gagal menyimpan");

      const saved = json.data as CurrencyPriceRow;
      setRows((prev) => ({ ...prev, [id]: toRowState(saved) }));
    } catch (e) {
      setError(id, e instanceof Error ? e.message : "Gagal menyimpan");
    }
  }

  async function toggleLock(id: string) {
    const state = rows[id];
    if (!state) return;

    setRows((prev) => ({ ...prev, [id]: { ...prev[id], locking: true, error: null } }));
    try {
      const res = await fetch(`/api/harga-valas/${id}/lock`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isLocked: !state.isLocked }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Gagal mengubah kunci");

      setRows((prev) => ({ ...prev, [id]: toRowState(json.data as CurrencyPriceRow) }));
      toast.success(json.message);
    } catch (e) {
      setRows((prev) => ({
        ...prev,
        [id]: {
          ...prev[id],
          locking: false,
          error: e instanceof Error ? e.message : "Gagal mengubah kunci",
        },
      }));
    }
  }

  async function runSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/harga-valas/sync", { method: "POST" });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Gagal sinkronisasi");

      const result = json.data as SyncResult;
      setRows((prev) => {
        const next = { ...prev };
        for (const row of result.rows) {
          next[row.currencyId] = toRowState(row, prev[row.currencyId]);
        }
        return next;
      });
      setSetting((prev) => ({
        ...prev,
        lastRunAt: new Date().toISOString(),
        lastRunSummary: result.summary,
      }));
      toast.success(result.summary);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal sinkronisasi");
    } finally {
      setSyncing(false);
    }
  }

  async function toggleAutoSync(autoSync: boolean) {
    const previous = setting.autoSync;
    setSetting((prev) => ({ ...prev, autoSync })); // optimistis — dikembalikan saat gagal
    try {
      const res = await fetch("/api/harga-valas/auto-sync", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoSync }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Gagal mengubah auto-sync");
      toast.success(json.message);
    } catch (e) {
      setSetting((prev) => ({ ...prev, autoSync: previous }));
      toast.error(e instanceof Error ? e.message : "Gagal mengubah auto-sync");
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Harga Valas"
        description="Harga beli dan jual yang dipakai perusahaan saat ini. Angkanya bisa diisi manual atau ditarik dari Patokan Harga."
        icon={<IconCurrencyDollar className="size-5" />}
        action={
          <>
            {currencyPageHref && (
              <Button variant="outline" size="sm" asChild>
                <Link href={currencyPageHref}>
                  <IconSettings className="size-4" />
                  Kelola Mata Uang
                </Link>
              </Button>
            )}
            {canManage && (
              <Button size="sm" onClick={runSync} disabled={syncing}>
                <IconRefresh className={syncing ? "size-4 animate-spin" : "size-4"} />
                {syncing ? "Menyinkronkan..." : "Sync sekarang"}
              </Button>
            )}
          </>
        }
      />

      <SectionCard
        title="Sinkronisasi dari Patokan Harga"
        description={
          <>
            Kurs SmartDeal dikenai aturan di{" "}
            {benchmarkPageHref ? (
              <Link href={benchmarkPageHref} className="underline underline-offset-2">
                Patokan Harga
              </Link>
            ) : (
              "Patokan Harga"
            )}
            , hasilnya masuk ke tabel di bawah. Baris yang dikunci tidak ikut berubah.
          </>
        }
        action={
          canManage && (
            <div className="flex items-center gap-2.5">
              <Label htmlFor="auto-sync" className="text-sm font-normal">
                Auto-sync
              </Label>
              <Switch
                id="auto-sync"
                checked={setting.autoSync}
                onCheckedChange={toggleAutoSync}
              />
            </div>
          )
        }
      >
        <p className="text-muted-foreground text-xs">
          {setting.autoSync
            ? "Menyala — harga diperbarui otomatis setiap kurs SmartDeal baru masuk."
            : "Mati — harga hanya berubah saat tombol Sync ditekan."}
          {setting.lastRunSummary && (
            <>
              {" "}
              Sync terakhir {formatDateTime(setting.lastRunAt)}:{" "}
              <span className="text-foreground">{setting.lastRunSummary}</span>.
            </>
          )}
        </p>
      </SectionCard>

      <MetricRow columns={3}>
        <MetricBlock
          label="Mata uang berharga"
          value={summary.priced}
          suffix={`/ ${summary.total}`}
          meta={
            summary.priced < summary.total
              ? `${summary.total - summary.priced} mata uang belum diisi harganya`
              : "Seluruh mata uang sudah punya harga"
          }
        />
        <MetricBlock
          label="Rata-rata spread"
          value={formatRate(summary.avgSpread)}
          prefix="Rp"
          meta="Selisih harga jual dan beli per 1 unit"
        />
        <MetricBlock
          label="Terkunci"
          value={summary.locked}
          suffix={`/ ${summary.priced}`}
          meta="Baris terkunci kebal terhadap sinkronisasi"
        />
      </MetricRow>

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
              {filtered.length} dari {activeRows.length} mata uang
            </span>
          </>
        }
      >
        {activeRows.length === 0 ? (
          <EmptyState
            icon={<IconCoins className="size-5" />}
            title="Belum ada mata uang"
            description="Tambahkan mata uang aktif di halaman Mata Uang terlebih dahulu, lalu isi harganya di sini."
            action={
              currencyPageHref && (
                <Button asChild>
                  <Link href={currencyPageHref}>Kelola Mata Uang</Link>
                </Button>
              )
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mata Uang</TableHead>
                <TableHead>Harga Beli (Rp)</TableHead>
                <TableHead>Harga Jual (Rp)</TableHead>
                <TableHead className="text-right">Spread</TableHead>
                <TableHead>Sumber</TableHead>
                {canManage && <TableHead className="w-24" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={canManage ? 6 : 5} className="p-0">
                    <EmptyState
                      title="Tidak ada hasil"
                      description={`Tidak ada mata uang yang cocok dengan "${search}".`}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r) => {
                  const state = rows[r.currencyId];
                  const dirty = state ? isDirty(state) : false;
                  const priced = Boolean(state?.savedBuyPrice && state?.savedSellPrice);

                  // Peringatan yang menentukan: harga manual yang tidak dikunci
                  // akan tertimpa diam-diam saat sync berikutnya jalan. Muncul
                  // di detik orang mengambil keputusan, bukan sehari kemudian.
                  const willBeOverwritten =
                    priced && !state?.isLocked && state?.source === "MANUAL";

                  return (
                    <TableRow key={r.currencyId}>
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
                          value={state?.buyPrice ?? ""}
                          onChange={(e) => updateField(r.currencyId, "buyPrice", e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveRow(r.currencyId);
                          }}
                          inputMode="decimal"
                          placeholder="mis. 16.250"
                          disabled={!canManage}
                          className="tabular h-8 max-w-36 font-mono"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={state?.sellPrice ?? ""}
                          onChange={(e) => updateField(r.currencyId, "sellPrice", e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveRow(r.currencyId);
                          }}
                          inputMode="decimal"
                          placeholder="mis. 16.400"
                          disabled={!canManage}
                          className="tabular h-8 max-w-36 font-mono"
                        />
                      </TableCell>
                      <TableCell className="tabular text-right font-medium">
                        {formatRate(state?.spread ?? null)}
                      </TableCell>
                      <TableCell>
                        {!priced ? (
                          <span className="text-muted-foreground text-xs">Belum diisi</span>
                        ) : (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs">
                              {state?.source === "SYNCED" ? "Sinkron" : "Manual"}
                              {state?.isLocked && (
                                <span className="text-muted-foreground"> · terkunci</span>
                              )}
                            </span>
                            <span className="text-muted-foreground text-[11px]">
                              {formatDateTime(state?.updatedAt ?? null)}
                            </span>
                          </div>
                        )}
                      </TableCell>
                      {canManage && (
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant={dirty ? "default" : "ghost"}
                              disabled={!dirty || state?.saving}
                              onClick={() => saveRow(r.currencyId)}
                              title={dirty ? "Simpan harga" : "Tersimpan"}
                            >
                              {state?.saving ? (
                                "..."
                              ) : dirty ? (
                                <IconDeviceFloppy className="size-4" />
                              ) : (
                                <IconCheck className="text-success size-4" />
                              )}
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              disabled={!priced || state?.locking}
                              onClick={() => toggleLock(r.currencyId)}
                              aria-label={
                                state?.isLocked
                                  ? `Lepas kunci harga ${r.code}`
                                  : `Kunci harga ${r.code}`
                              }
                              title={
                                !priced
                                  ? "Isi harganya dulu sebelum dikunci"
                                  : state?.isLocked
                                    ? "Terkunci — kebal terhadap sync. Klik untuk melepas."
                                    : "Terbuka — akan tertimpa saat sync. Klik untuk mengunci."
                              }
                            >
                              {state?.isLocked ? (
                                <IconLock className="text-warning size-4" />
                              ) : (
                                <IconLockOpen className="text-muted-foreground size-4" />
                              )}
                            </Button>
                          </div>
                          {willBeOverwritten && (
                            <p className="text-muted-foreground mt-1 text-[11px]">
                              Akan tertimpa saat sync — kunci?
                            </p>
                          )}
                          {state?.error && (
                            <p className="text-destructive mt-1 text-xs">{state.error}</p>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        )}
      </SectionCard>
    </PageShell>
  );
}
