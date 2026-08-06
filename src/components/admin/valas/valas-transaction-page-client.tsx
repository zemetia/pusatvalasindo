"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import {
  IconArrowsExchange,
  IconBan,
  IconLoader2,
  IconPlus,
  IconReceipt,
  IconRefresh,
} from "@tabler/icons-react";

import {
  SectionCard,
  EmptyState,
  MetricRow,
  MetricBlock,
} from "@/components/admin/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Combobox } from "@/components/ui/combobox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EM_DASH, formatIdr, formatQty, formatRate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ValasTransactionRow } from "@/backend/services/valas-transaction.service";

/* ── Bentuk data ──────────────────────────────────────────────────────────── */

type Company = { id: string; name: string };
type TxType = "BUY" | "SELL";

type PriceOption = {
  currencyId: string;
  code: string;
  name: string;
  symbol: string | null;
  buyPrice: number;
  sellPrice: number;
};

type BankAccountOption = {
  id: string;
  bankName: string;
  accountNumber: string | null;
  accountName: string;
};

type Payload = {
  serverDate?: string | null;
  rows?: ValasTransactionRow[];
  summary?: {
    buy: { total: number; count: number };
    sell: { total: number; count: number };
    net: number;
  };
  byCurrency?: { currencyId: string; code: string; type: TxType; amount: number; count: number }[];
  prices?: PriceOption[];
  bankAccounts?: BankAccountOption[];
  identityThreshold?: number;
};

const LAST_SELECTION_KEY = "transaksi-valas:last-company";

const ID_TYPES = ["KTP", "SIM", "PASSPORT", "KITAS", "NPWP", "LAINNYA"] as const;

const EMPTY_SUMMARY = {
  buy: { total: 0, count: 0 },
  sell: { total: 0, count: 0 },
  net: 0,
};

function toDateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** Isi input → angka. Menerima gaya Indonesia (`16.250,50`) maupun polos. */
function parseAmount(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const normalized = trimmed.includes(",")
    ? trimmed.replace(/\./g, "").replace(",", ".")
    : trimmed.replace(/\.(?=\d{3}(\D|$))/g, "");
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function readLastSelection(): string | null {
  try {
    return window.localStorage.getItem(LAST_SELECTION_KEY);
  } catch {
    return null;
  }
}

// Alasan pola `useSyncExternalStore` di sini sama persis dengan Dana Tertahan:
// render server tidak punya `localStorage`, dan `setState` di dalam efek dilarang
// lint repo ini. Lihat catatan panjangnya di held-fund-page-client.tsx.
const NO_SUBSCRIBE = () => () => {};
const NO_SERVER_VALUE = () => null;

interface Props {
  companies: Company[];
  defaultCompanyId: string | null;
  /** PT yang boleh dicatat transaksinya; `null` = semua PT. */
  writableCompanyIds: string[] | null;
  /** PT yang transaksinya boleh dibatalkan (izin `valas.transaction.void`). */
  voidCompanyIds: string[] | null;
  /** PT yang boleh diisi untuk tanggal lampau (izin `daily.backdate`). */
  backdateCompanyIds: string[] | null;
  canSelectCompany: boolean;
  initialData?: unknown;
  /** `${companyId}:${YYYY-MM-DD}` milik initialData — dipakai hanya kalau cocok. */
  initialKey?: string | null;
}

/**
 * Transaksi Jual & Beli Valas.
 *
 * Tiga izin bertemu di satu halaman dan UI-nya harus jujur soal ketiganya —
 * server tetap yang memutuskan, tapi kontrol yang pasti ditolak tidak boleh
 * terlihat bisa dipakai:
 *
 * • `valas.transaction` (tulis)   → mencatat transaksi baru
 * • `daily.backdate`              → tambahan wajib untuk tanggal lampau
 * • `valas.transaction.void`      → membatalkan transaksi yang sudah tercatat
 */
export function ValasTransactionPageClient({
  companies,
  defaultCompanyId,
  writableCompanyIds,
  voidCompanyIds,
  backdateCompanyIds,
  canSelectCompany,
  initialData,
  initialKey,
}: Props) {
  const [date, setDate] = useState(() => toDateKey(new Date()));

  const [picked, setPicked] = useState<string | null>(null);
  const savedCompanyId = useSyncExternalStore(NO_SUBSCRIBE, readLastSelection, NO_SERVER_VALUE);
  const restored =
    canSelectCompany && savedCompanyId && companies.some((c) => c.id === savedCompanyId)
      ? savedCompanyId
      : null;
  const companyId = picked ?? restored ?? defaultCompanyId ?? "";

  const selectCompany = (id: string) => {
    setPicked(id);
    try {
      window.localStorage.setItem(LAST_SELECTION_KEY, id);
    } catch {
      // Mode privat / storage penuh: kehilangan preferensi tidak boleh
      // menggagalkan perpindahan PT.
    }
  };

  // Payload server hanya sah untuk kombinasi PT + tanggal saat halaman dirender.
  const [seed] = useState<Payload | null>(() =>
    initialData && initialKey && initialKey === `${defaultCompanyId ?? ""}:${toDateKey(new Date())}`
      ? (initialData as Payload)
      : null
  );

  const [rows, setRows] = useState<ValasTransactionRow[]>(() => seed?.rows ?? []);
  const [summary, setSummary] = useState(() => seed?.summary ?? EMPTY_SUMMARY);
  const [prices, setPrices] = useState<PriceOption[]>(() => seed?.prices ?? []);
  const [bankAccounts, setBankAccounts] = useState<BankAccountOption[]>(
    () => seed?.bankAccounts ?? []
  );
  const [identityThreshold, setIdentityThreshold] = useState(
    () => seed?.identityThreshold ?? 100_000_000
  );
  const [serverDate, setServerDate] = useState<string | null>(() => seed?.serverDate ?? null);
  const [fetching, setFetching] = useState(false);

  const [typeFilter, setTypeFilter] = useState<"ALL" | TxType>("ALL");
  const [search, setSearch] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [voidTarget, setVoidTarget] = useState<ValasTransactionRow | null>(null);

  const inScope = (list: string[] | null) =>
    !!companyId && (list === null || list.includes(companyId));

  // Ketiga hak dihitung dari PT yang SEDANG dipilih, bukan sekali dari PT bawaan.
  const canInput = inScope(writableCompanyIds);
  const canVoid = inScope(voidCompanyIds);
  const canBackdate = inScope(backdateCompanyIds);

  // `serverDate` datang dari server supaya jam browser yang salah tidak membuka
  // tanggal lampau untuk diisi.
  const isPast = serverDate !== null && date < serverDate;
  const canRecord = canInput && (!isPast || canBackdate);

  /* ── Muat data ──────────────────────────────────────────────────────────── */

  const loadData = useCallback(async () => {
    if (!companyId || !date) return;
    setFetching(true);
    try {
      const res = await fetch(`/api/valas-transactions?companyId=${companyId}&date=${date}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.message || data.error || "Gagal memuat data");
        setRows([]);
        return;
      }
      const payload = data.data as Payload;
      setServerDate(payload.serverDate ?? null);
      setRows(payload.rows ?? []);
      setSummary(payload.summary ?? EMPTY_SUMMARY);
      setPrices(payload.prices ?? []);
      setBankAccounts(payload.bankAccounts ?? []);
      if (payload.identityThreshold) setIdentityThreshold(payload.identityThreshold);
    } catch {
      toast.error("Gagal memuat data");
      setRows([]);
    } finally {
      setFetching(false);
    }
  }, [companyId, date]);

  /**
   * Menarik ulang daftar harga saja — dipakai tombol re-sync di form.
   *
   * Harga Valas bisa berubah setelah halaman ini dibuka (kasir lain menyimpan,
   * atau auto-sync jalan). Baris transaksi sengaja tidak ikut disentuh supaya
   * form yang sedang diisi tidak terganggu oleh muat ulang tabel di belakangnya.
   */
  const [syncingPrices, setSyncingPrices] = useState(false);
  const refreshPrices = useCallback(async () => {
    if (!companyId || !date) return;
    setSyncingPrices(true);
    try {
      const res = await fetch(`/api/valas-transactions?companyId=${companyId}&date=${date}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.message || data.error || "Gagal menyegarkan harga valas");
        return;
      }
      const payload = data.data as Payload;
      setPrices(payload.prices ?? []);
      toast.success("Harga valas disegarkan");
    } catch {
      toast.error("Gagal menyegarkan harga valas");
    } finally {
      setSyncingPrices(false);
    }
  }, [companyId, date]);

  // Kalau baris awal sudah datang bersama HTML, lewati fetch pertama.
  const skipFirstLoadRef = useRef(seed !== null);
  useEffect(() => {
    if (skipFirstLoadRef.current) {
      skipFirstLoadRef.current = false;
      return;
    }
    loadData();
  }, [loadData]);

  /* ── Penyaringan (lokal — rekap di atas TIDAK ikut tersaring) ───────────── */

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (typeFilter !== "ALL" && r.type !== typeFilter) return false;
      if (!q) return true;
      return (
        r.invoiceNo.toLowerCase().includes(q) ||
        r.customerName.toLowerCase().includes(q) ||
        r.currencyCode.toLowerCase().includes(q) ||
        (r.customerIdNumber ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, typeFilter]);

  const companyName = companies.find((c) => c.id === companyId)?.name ?? EM_DASH;

  return (
    <div className="flex flex-col gap-4">
      {/* ── Kontrol ─────────────────────────────────────────────────────── */}
      <div className="bg-card flex flex-wrap items-end gap-3 rounded-xl border p-4 shadow-sm">
        <div className="grid gap-1.5">
          <Label className="text-muted-foreground text-xs font-medium">Tanggal</Label>
          <Input
            type="date"
            value={date}
            max={serverDate ?? undefined}
            onChange={(e) => setDate(e.target.value)}
            className="h-9 w-[170px]"
          />
        </div>

        {canSelectCompany && (
          <div className="grid gap-1.5">
            <Label className="text-muted-foreground text-xs font-medium">PT</Label>
            <Combobox
              value={companyId}
              onValueChange={selectCompany}
              options={companies.map((c) => ({ value: c.id, label: c.name }))}
              placeholder="Pilih PT"
              searchPlaceholder="Cari PT..."
              className="w-[220px]"
            />
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          {fetching && <IconLoader2 className="text-muted-foreground size-4 animate-spin" />}
          <Button
            onClick={() => setFormOpen(true)}
            disabled={!canRecord}
            title={
              !canInput
                ? "Tidak punya izin mencatat transaksi untuk PT ini"
                : isPast && !canBackdate
                  ? "Tanggal sudah lewat — perlu izin ubah tanggal lampau"
                  : undefined
            }
          >
            <IconPlus className="size-4" /> Transaksi Baru
          </Button>
        </div>
      </div>

      {/* ── Rekap hari itu ──────────────────────────────────────────────── */}
      <MetricRow columns={4} title={`${companyName} · ${date}`}>
        <MetricBlock
          label="Beli dari nasabah"
          value={formatIdr(summary.buy.total)}
          meta={`${summary.buy.count} transaksi · valas masuk`}
        />
        <MetricBlock
          label="Jual ke nasabah"
          value={formatIdr(summary.sell.total)}
          meta={`${summary.sell.count} transaksi · valas keluar`}
        />
        <MetricBlock
          label="Selisih rupiah"
          value={formatIdr(summary.net)}
          tone={summary.net < 0 ? "destructive" : "default"}
          meta="Rupiah keluar untuk beli dikurangi rupiah masuk dari jual — bukan laba"
        />
        <MetricBlock
          label="Total transaksi"
          value={String(summary.buy.count + summary.sell.count)}
          size="secondary"
          meta={
            rows.some((r) => r.status === "VOID")
              ? `${rows.filter((r) => r.status === "VOID").length} dibatalkan (tidak dihitung)`
              : "Belum ada yang dibatalkan"
          }
        />
      </MetricRow>

      {/* ── Daftar transaksi ────────────────────────────────────────────── */}
      <SectionCard
        title="Daftar Transaksi"
        description="Transaksi yang dibatalkan tetap ditampilkan beserta alasannya — nomor buktinya tidak pernah didaur ulang."
        icon={<IconReceipt className="size-4" />}
        padded={false}
        toolbar={
          <>
            <Combobox
              value={typeFilter}
              onValueChange={(v) => setTypeFilter(v as "ALL" | TxType)}
              options={[
                { value: "ALL", label: "Semua jenis" },
                { value: "SELL", label: "Jual ke nasabah" },
                { value: "BUY", label: "Beli dari nasabah" },
              ]}
              size="sm"
              className="w-[150px]"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari no. bukti / nasabah / mata uang"
              className="h-8 w-[280px]"
            />
          </>
        }
      >
        {visible.length === 0 ? (
          <EmptyState
            icon={<IconArrowsExchange className="size-5" />}
            title={rows.length === 0 ? "Belum ada transaksi" : "Tidak ada yang cocok"}
            description={
              rows.length === 0
                ? "Setiap hari dimulai kosong. Catat transaksi pertama lewat tombol Transaksi Baru."
                : "Ubah kata kunci atau filter jenisnya."
            }
            className="m-5"
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No. Bukti</TableHead>
                  <TableHead>Jenis</TableHead>
                  <TableHead>Nasabah</TableHead>
                  <TableHead className="text-right">Jumlah</TableHead>
                  <TableHead className="text-right">Kurs</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Bayar</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((r) => {
                  const voided = r.status === "VOID";
                  return (
                    <TableRow key={r.id} className={cn(voided && "opacity-55")}>
                      <TableCell className="tabular font-mono text-xs">
                        {r.invoiceNo}
                        {voided && (
                          <Badge variant="destructive" className="ml-2 text-[10px]">
                            Batal
                          </Badge>
                        )}
                        {voided && r.voidReason && (
                          <div className="text-muted-foreground mt-0.5 text-[11px]">
                            {r.voidReason}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "text-xs font-medium",
                            r.type === "SELL" ? "text-emerald-600" : "text-sky-600"
                          )}
                        >
                          {r.type === "SELL" ? "Jual" : "Beli"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{r.customerName}</div>
                        <div className="text-muted-foreground text-[11px]">
                          {r.customerIdType
                            ? `${r.customerIdType} ${r.customerIdNumber ?? ""}`.trim()
                            : (r.customerPhone ?? EM_DASH)}
                        </div>
                      </TableCell>
                      <TableCell className="tabular text-right">
                        {formatQty(r.amount)} {r.currencyCode}
                      </TableCell>
                      <TableCell className="tabular text-right">
                        {formatRate(r.rate)}
                        {r.rateDelta != null && r.rateDelta !== 0 && (
                          <div
                            className={cn(
                              "text-[11px]",
                              r.rateDelta > 0 ? "text-emerald-600" : "text-destructive"
                            )}
                            title="Selisih terhadap Harga Valas, dari sudut untung perusahaan"
                          >
                            {r.rateDelta > 0 ? "+" : ""}
                            {formatRate(r.rateDelta)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="tabular text-right font-medium">
                        {formatIdr(r.totalIdr)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.paymentMethod === "CASH" ? "Tunai" : (r.bankAccountLabel ?? "Transfer")}
                      </TableCell>
                      <TableCell>
                        {!voided && canVoid && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive size-8"
                            title="Batalkan transaksi"
                            onClick={() => setVoidTarget(r)}
                          >
                            <IconBan className="size-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>

      <TransactionFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        companyId={companyId}
        date={date}
        prices={prices}
        bankAccounts={bankAccounts}
        identityThreshold={identityThreshold}
        onSaved={loadData}
        onSyncPrices={refreshPrices}
        syncingPrices={syncingPrices}
      />

      <VoidDialog target={voidTarget} onClose={() => setVoidTarget(null)} onVoided={loadData} />
    </div>
  );
}

/* ── Form transaksi ───────────────────────────────────────────────────────── */

const EMPTY_FORM = {
  type: "SELL" as TxType,
  currencyId: "",
  amount: "",
  rate: "",
  customerName: "",
  customerPhone: "",
  customerIdType: "NONE",
  customerIdNumber: "",
  customerAddress: "",
  paymentMethod: "CASH" as "CASH" | "TRANSFER",
  bankAccountId: "",
  note: "",
};

function TransactionFormDialog({
  open,
  onOpenChange,
  companyId,
  date,
  prices,
  bankAccounts,
  identityThreshold,
  onSaved,
  onSyncPrices,
  syncingPrices,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  date: string;
  prices: PriceOption[];
  bankAccounts: BankAccountOption[];
  identityThreshold: number;
  onSaved: () => void;
  onSyncPrices: () => void;
  syncingPrices: boolean;
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  /** True setelah kurs disentuh tangan — mengunci pengisian otomatis. */
  const [rateTouched, setRateTouched] = useState(false);

  const set = <K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const selected = prices.find((p) => p.currencyId === form.currencyId) ?? null;
  // Harga yang berlaku untuk sisi yang dipilih: JUAL pakai harga jual, BELI pakai
  // harga beli — sama persis dengan yang dihitung ulang server saat menyimpan.
  const listedRate = selected ? (form.type === "SELL" ? selected.sellPrice : selected.buyPrice) : null;

  const amount = parseAmount(form.amount);
  const rate = rateTouched ? parseAmount(form.rate) : listedRate;
  const total = amount != null && rate != null ? Math.round(amount * rate) : null;
  const needsIdentity = total != null && total >= identityThreshold;

  /**
   * Mengganti mata uang / sisi transaksi mengisi ulang kurs dari Harga Valas —
   * kecuali kursnya sudah disentuh tangan. Dijalankan di handler, bukan efek:
   * pengisian ini adalah respons terhadap sebuah pilihan user.
   */
  function applyRateFor(nextType: TxType, nextCurrencyId: string) {
    if (rateTouched) return;
    const price = prices.find((p) => p.currencyId === nextCurrencyId);
    setForm((f) => ({
      ...f,
      type: nextType,
      currencyId: nextCurrencyId,
      rate: price ? String(nextType === "SELL" ? price.sellPrice : price.buyPrice) : "",
    }));
  }

  function reset() {
    setForm(EMPTY_FORM);
    setRateTouched(false);
  }

  async function submit() {
    if (!form.currencyId) return toast.error("Pilih mata uang");
    if (amount == null || amount <= 0) return toast.error("Jumlah valas harus lebih dari nol");
    if (rate == null || rate <= 0) return toast.error("Kurs harus lebih dari nol");
    if (!form.customerName.trim()) return toast.error("Nama nasabah wajib diisi");
    if (needsIdentity && (form.customerIdType === "NONE" || !form.customerIdNumber.trim())) {
      return toast.error(
        `Transaksi ≥ ${formatIdr(identityThreshold)} wajib mencantumkan identitas nasabah`
      );
    }
    if (form.paymentMethod === "TRANSFER" && !form.bankAccountId) {
      return toast.error("Pilih rekening untuk pembayaran transfer");
    }

    setSaving(true);
    try {
      const res = await fetch("/api/valas-transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          date,
          type: form.type,
          currencyId: form.currencyId,
          amount,
          // Kurs dikirim hanya kalau memang dinego — kalau tidak, server yang
          // membaca Harga Valas, jadi harga yang tercatat tidak pernah berasal
          // dari layar yang kedaluwarsa.
          rate: rateTouched ? rate : undefined,
          customerName: form.customerName.trim(),
          customerPhone: form.customerPhone.trim() || undefined,
          customerIdType: form.customerIdType === "NONE" ? undefined : form.customerIdType,
          customerIdNumber: form.customerIdNumber.trim() || undefined,
          customerAddress: form.customerAddress.trim() || undefined,
          paymentMethod: form.paymentMethod,
          bankAccountId: form.paymentMethod === "TRANSFER" ? form.bankAccountId : undefined,
          note: form.note.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || "Gagal menyimpan transaksi");
      }

      toast.success(data.message ?? "Transaksi tercatat");
      reset();
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan transaksi");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Transaksi Baru</DialogTitle>
          <DialogDescription>
            Kurs terisi otomatis dari Harga Valas dan boleh diubah bila dinego. Angka yang
            tersimpan adalah kurs yang benar-benar dipakai.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {/* Re-sync harga: memastikan kurs di form sama dengan Harga Valas
              saat ini, bukan yang ikut terbawa waktu halaman dibuka. */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-muted-foreground text-[11px]">
              {prices.length > 0
                ? `${prices.length} mata uang berharga · dari Harga Valas`
                : "Belum ada harga yang dimuat"}
            </span>
            <div className="flex items-center gap-2">
              {rateTouched && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    setRateTouched(false);
                    set("rate", "");
                  }}
                >
                  Pakai Harga Valas
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={onSyncPrices}
                disabled={syncingPrices}
                title="Tarik ulang harga terbaru dari Harga Valas"
              >
                {syncingPrices ? (
                  <IconLoader2 className="size-3.5 animate-spin" />
                ) : (
                  <IconRefresh className="size-3.5" />
                )}
                Re-sync Harga Valas
              </Button>
            </div>
          </div>

          {/* Sisi transaksi */}
          <div className="grid grid-cols-2 gap-2">
            {(["SELL", "BUY"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => applyRateFor(t, form.currencyId)}
                className={cn(
                  "rounded-lg border px-3 py-2 text-left text-sm transition",
                  form.type === t
                    ? "border-primary bg-primary/5 font-medium"
                    : "text-muted-foreground hover:bg-muted/50"
                )}
              >
                {t === "SELL" ? "Jual ke nasabah" : "Beli dari nasabah"}
                <span className="text-muted-foreground block text-[11px] font-normal">
                  {t === "SELL" ? "Valas keluar, rupiah masuk" : "Valas masuk, rupiah keluar"}
                </span>
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label className="text-xs">Mata uang</Label>
              <Combobox
                value={form.currencyId}
                onValueChange={(v) => applyRateFor(form.type, v)}
                options={prices.map((p) => ({
                  value: p.currencyId,
                  label: p.code,
                  description: p.name,
                }))}
                placeholder="Pilih"
                searchPlaceholder="Cari kode / nama mata uang..."
                emptyText="Mata uang tidak ditemukan."
              />
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs">Jumlah valas</Label>
              <Input
                inputMode="decimal"
                value={form.amount}
                onChange={(e) => set("amount", e.target.value)}
                placeholder="0"
                className="tabular h-9 text-right"
              />
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs">
                Kurs {listedRate != null && !rateTouched && <span className="text-muted-foreground">(Harga Valas)</span>}
              </Label>
              <Input
                inputMode="decimal"
                value={rateTouched ? form.rate : listedRate != null ? String(listedRate) : ""}
                onChange={(e) => {
                  setRateTouched(true);
                  set("rate", e.target.value);
                }}
                placeholder="0"
                className="tabular h-9 text-right"
              />
            </div>
          </div>

          {prices.length === 0 && (
            <p className="text-destructive text-xs">
              Belum ada mata uang yang punya harga di Harga Valas. Isi harganya dulu di halaman
              Harga Valas.
            </p>
          )}

          {/* Total & jejak kurs */}
          <div className="bg-muted/40 flex flex-wrap items-baseline justify-between gap-2 rounded-lg px-4 py-3">
            <div>
              <div className="text-muted-foreground text-[11px] tracking-wide uppercase">
                Total rupiah
              </div>
              <div className="tabular text-2xl font-semibold">
                {total == null ? EM_DASH : formatIdr(total)}
              </div>
            </div>
            {rateTouched && listedRate != null && rate != null && rate !== listedRate && (
              <div className="text-muted-foreground text-xs">
                Harga Valas {formatRate(listedRate)} · dinego{" "}
                {rate > listedRate ? "+" : ""}
                {formatRate(rate - listedRate)}
              </div>
            )}
          </div>

          {/* Nasabah */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label className="text-xs">Nama nasabah</Label>
              <Input
                value={form.customerName}
                onChange={(e) => set("customerName", e.target.value)}
                placeholder="Nama lengkap"
                className="h-9"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">No. HP</Label>
              <Input
                value={form.customerPhone}
                onChange={(e) => set("customerPhone", e.target.value)}
                placeholder="Opsional"
                className="h-9"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label className="text-xs">
                Jenis identitas {needsIdentity && <span className="text-destructive">*</span>}
              </Label>
              <Combobox
                value={form.customerIdType}
                onValueChange={(v) => set("customerIdType", v)}
                options={[
                  { value: "NONE", label: "Tidak dicatat" },
                  ...ID_TYPES.map((t) => ({ value: t, label: t })),
                ]}
              />
            </div>
            <div className="grid gap-1.5 sm:col-span-2">
              <Label className="text-xs">
                Nomor identitas {needsIdentity && <span className="text-destructive">*</span>}
              </Label>
              <Input
                value={form.customerIdNumber}
                onChange={(e) => set("customerIdNumber", e.target.value)}
                placeholder={needsIdentity ? "Wajib untuk transaksi besar" : "Opsional"}
                className="h-9"
              />
            </div>
          </div>

          {needsIdentity && (
            <p className="text-xs text-amber-600">
              Transaksi ≥ {formatIdr(identityThreshold)} wajib mencantumkan identitas nasabah.
            </p>
          )}

          <div className="grid gap-1.5">
            <Label className="text-xs">Alamat</Label>
            <Input
              value={form.customerAddress}
              onChange={(e) => set("customerAddress", e.target.value)}
              placeholder="Opsional"
              className="h-9"
            />
          </div>

          {/* Pembayaran */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label className="text-xs">Pembayaran</Label>
              <Combobox
                value={form.paymentMethod}
                onValueChange={(v) => set("paymentMethod", v as "CASH" | "TRANSFER")}
                options={[
                  { value: "CASH", label: "Tunai" },
                  { value: "TRANSFER", label: "Transfer" },
                ]}
              />
            </div>
            {form.paymentMethod === "TRANSFER" && (
              <div className="grid gap-1.5">
                <Label className="text-xs">Rekening</Label>
                <Combobox
                  value={form.bankAccountId}
                  onValueChange={(v) => set("bankAccountId", v)}
                  options={bankAccounts.map((a) => ({
                    value: a.id,
                    label: a.bankName,
                    description: a.accountNumber ?? undefined,
                  }))}
                  placeholder="Pilih rekening"
                  searchPlaceholder="Cari bank / no. rekening..."
                  emptyText="Rekening tidak ditemukan."
                />
              </div>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs">Catatan</Label>
            <Textarea
              value={form.note}
              onChange={(e) => set("note", e.target.value)}
              placeholder="Opsional"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Batal
          </Button>
          <Button onClick={submit} disabled={saving || prices.length === 0}>
            {saving && <IconLoader2 className="size-4 animate-spin" />}
            Simpan Transaksi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Pembatalan ───────────────────────────────────────────────────────────── */

function VoidDialog({
  target,
  onClose,
  onVoided,
}: {
  target: ValasTransactionRow | null;
  onClose: () => void;
  onVoided: () => void;
}) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!target) return;
    if (reason.trim().length < 3) return toast.error("Alasan pembatalan wajib diisi");

    setSaving(true);
    try {
      const res = await fetch(`/api/valas-transactions/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || "Gagal membatalkan");
      }
      toast.success(data.message ?? "Transaksi dibatalkan");
      setReason("");
      onClose();
      onVoided();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal membatalkan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={target !== null}
      onOpenChange={(next) => {
        if (!next) {
          setReason("");
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Batalkan Transaksi</DialogTitle>
          <DialogDescription>
            {target
              ? `${target.invoiceNo} · ${formatQty(target.amount)} ${target.currencyCode} · ${formatIdr(target.totalIdr)}`
              : ""}
            . Barisnya tetap tersimpan dengan status Batal — angkanya keluar dari semua total,
            tapi nomor buktinya tidak didaur ulang.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-1.5">
          <Label className="text-xs">Alasan pembatalan</Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="mis. salah input jumlah, nasabah membatalkan"
            rows={3}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Kembali
          </Button>
          <Button variant="destructive" onClick={submit} disabled={saving}>
            {saving && <IconLoader2 className="size-4 animate-spin" />}
            Batalkan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
