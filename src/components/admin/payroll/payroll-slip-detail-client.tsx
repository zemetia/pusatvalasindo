"use client";

// Detail gaji satu karyawan untuk satu bulan — dasar dari PayrollSlip yang
// tersimpan (bukan kalkulator ad hoc). Di sinilah HR menambah penyesuaian
// manual (bonus/pengurangan) di luar rule reward & denda, dengan alasan
// wajib tertulis (PayrollSlipEntry.source = MANUAL).
//
// Tata letak: di layar lebar halaman dibagi dua — kolom kiri berisi alasan
// (rincian entri, kehadiran, form penyesuaian), kolom kanan berisi angkanya
// (komponen gaji, rekap, tombol aksi) dan ikut menempel saat digulir. Sebelumnya
// semuanya satu kolom sempit, sehingga separuh layar kosong dan orang harus
// menggulir jauh untuk mencocokkan denda dengan total.

import { useState } from "react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  IconPlus,
  IconTrash,
  IconAlertTriangle,
  IconRefresh,
  IconCoin,
  IconChevronRight,
} from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { Combobox } from "@/components/ui/combobox";
import { MetricBlock, MetricRow } from "@/components/admin/page-shell";
import { AttendanceMonthStrip } from "@/components/admin/payroll/attendance-month-strip";
import { SlipKpiSection } from "@/components/admin/payroll/slip-kpi-section";
import { MONTH_NAMES, formatCurrency, formatAmount } from "@/lib/kpi-utils";
import type { PayrollSlipDetailView } from "@/app/api/payroll/runs/serialize";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Belum dibayar",
  FINALIZED: "Siap dibayar",
  PAID: "Sudah dibayar",
  VOID: "Digantikan perhitungan lain",
};

const SOURCE_LABEL: Record<string, string> = {
  RULE: "Rule reward/denda",
  COMPONENT: "Komponen gaji",
  SISTEM: "Sistem",
  MANUAL: "Manual (HR)",
};

const TYPE_LABEL: Record<string, string> = {
  BONUS: "Bonus",
  DENDA: "Denda",
  POTONGAN: "Potongan",
  TUNJANGAN: "Tunjangan",
};

type ApiResponse = { data: { slip: PayrollSlipDetailView | null } | null; message: string | null };

/** Satu baris rincian pada entri `mode: per_baris` — biasanya satu tanggal. */
type BreakdownRow = {
  keterangan: string;
  tier: string | null;
  label: string;
  nominal: number;
  inputs: Record<string, unknown> | null;
};

async function readError(res: Response) {
  const json = await res.json().catch(() => null);
  return json?.message ?? "Terjadi kesalahan";
}

/* ── Judul section ─────────────────────────────────────────────────────── */

function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {children}
      </h2>
      {hint && <span className="text-muted-foreground text-xs">{hint}</span>}
    </div>
  );
}

/** Satu baris komponen gaji tetap — disembunyikan kalau nilainya 0. */
function ComponentLine({ label, value }: { label: string; value: number }) {
  if (value <= 0) return null;
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground min-w-0 truncate">{label}</span>
      <span className="tabular shrink-0">{formatCurrency(value)}</span>
    </div>
  );
}

/**
 * Komponen gaji yang datang sebagai entri (`source: COMPONENT`) — mis. Uang
 * Makan dan Uang Transport yang dihitung per hari hadir.
 *
 * Tempatnya di sini, bukan di daftar "Rincian bonus, denda & potongan":
 * keduanya bagian dari gaji kotor yang memang dijanjikan, bukan penyesuaian
 * atas kinerja atau pelanggaran seperti bonus dan denda.
 */
function ComponentEntryLine({ entry }: { entry: PayrollSlipDetailView["entries"][number] }) {
  const dilewati = entry.status !== "APPLIED";
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground min-w-0 truncate">
        {entry.label}
        {dilewati && (
          <span className="ml-1.5 text-xs">({entry.status === "ERROR" ? "gagal" : "dilewati"})</span>
        )}
      </span>
      <span className={`tabular shrink-0 ${dilewati ? "text-muted-foreground" : ""}`}>
        {dilewati ? "—" : formatCurrency(entry.amount)}
      </span>
    </div>
  );
}

/** Baris rekap di kaki kolom kanan. */
function RecapLine({
  label,
  value,
  tone,
  strong,
}: {
  label: string;
  value: number;
  tone?: "success" | "destructive";
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span
        className={strong ? "text-sm font-medium" : "text-muted-foreground text-sm"}
      >
        {label}
      </span>
      <span
        className={`tabular shrink-0 ${strong ? "text-base font-semibold" : "text-sm"} ${
          tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : ""
        }`}
      >
        {formatCurrency(value)}
      </span>
    </div>
  );
}

/* ── Rincian per baris (mis. denda keterlambatan per tanggal) ───────────── */

function EntryBreakdown({ rows }: { rows: BreakdownRow[] }) {
  const [open, setOpen] = useState(false);
  const berdampak = rows.filter((r) => r.nominal !== 0);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="text-muted-foreground hover:text-foreground -ml-1 mt-1 flex items-center gap-1 rounded px-1 text-xs transition-colors">
        <IconChevronRight
          className={`size-3.5 transition-transform ${open ? "rotate-90" : ""}`}
        />
        {rows.length} hari tercatat
        {berdampak.length !== rows.length && ` · ${berdampak.length} berdampak`}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-border/60 bg-muted/25 mt-2 overflow-x-auto rounded-md border">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr className="border-b">
                <th className="px-3 py-2 text-left font-medium">Tanggal</th>
                <th className="px-3 py-2 text-left font-medium">Dasar hitungan</th>
                <th className="px-3 py-2 text-right font-medium">Nominal</th>
              </tr>
            </thead>
            <tbody className="divide-border/60 divide-y">
              {rows.map((r, i) => (
                <tr key={`${r.keterangan}-${i}`} className={r.nominal === 0 ? "opacity-60" : ""}>
                  <td className="tabular px-3 py-1.5 whitespace-nowrap">{r.keterangan}</td>
                  <td className="text-muted-foreground px-3 py-1.5">
                    {describeInputs(r.inputs) || r.label}
                  </td>
                  <td
                    className={`tabular px-3 py-1.5 text-right whitespace-nowrap ${
                      r.nominal < 0 ? "text-destructive" : r.nominal > 0 ? "text-success" : ""
                    }`}
                  >
                    {r.nominal === 0
                      ? "—"
                      : `${r.nominal >= 0 ? "+" : "−"}${formatCurrency(Math.abs(r.nominal))}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * Angka mentah yang dipakai rule pada satu baris, mis. `menit_telat 25 ·
 * urutan_pelanggaran 2`. Tanggalnya sudah jadi kolom sendiri, jadi tidak
 * diulang di sini.
 */
function describeInputs(inputs: Record<string, unknown> | null): string {
  if (!inputs) return "";
  return Object.entries(inputs)
    .filter(([k, v]) => !["tanggal", "date", "tgl"].includes(k) && typeof v !== "object")
    .map(([k, v]) => `${k.replace(/_/g, " ")} ${typeof v === "number" ? formatAmount(v) : String(v)}`)
    .join(" · ");
}

function asBreakdown(value: unknown): BreakdownRow[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  return value as BreakdownRow[];
}

/* ── Halaman ───────────────────────────────────────────────────────────── */

export function PayrollSlipDetailClient({
  slip: initialSlip,
  canManage,
  onSlipChanged,
}: {
  slip: PayrollSlipDetailView;
  canManage: boolean;
  /** Dipanggil setelah slip ini berubah (manual entry, hitung ulang, bayar) —
   *  supaya pemanggil (mis. daftar karyawan) bisa invalidate query listnya
   *  sendiri dan badge/nominal di baris ikut ter-update. */
  onSlipChanged?: () => void;
}) {
  const queryClient = useQueryClient();
  const queryKey = ["payroll-slip", initialSlip.id] as const;

  const { data: slip } = useQuery<PayrollSlipDetailView>({
    queryKey,
    initialData: initialSlip,
    queryFn: async () => {
      const res = await fetch(`/api/payroll/runs/${initialSlip.runId}/slips/${initialSlip.id}`);
      if (!res.ok) throw new Error(await readError(res));
      const json = (await res.json()) as ApiResponse;
      if (!json.data?.slip) throw new Error("Slip gaji tidak ditemukan");
      return json.data.slip;
    },
  });

  const applyResult = (json: ApiResponse) => {
    if (json.data?.slip) queryClient.setQueryData(queryKey, json.data.slip);
    onSlipChanged?.();
  };

  const runTerkunci = slip.runStatus === "PAID" || slip.runStatus === "VOID";

  const recalculate = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/payroll/runs/${slip.runId}/slips/${slip.id}/recalculate`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? "Gagal menghitung ulang slip");
      return json;
    },
    onSuccess: () => {
      toast.success("Slip berhasil dihitung ulang");
      queryClient.invalidateQueries({ queryKey });
      onSlipChanged?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markPaid = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/payroll/runs/${slip.runId}/slips/${slip.id}/pay`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? "Gagal menandai gaji sudah dibayar");
      return json;
    },
    onSuccess: () => {
      toast.success("Gaji ditandai sudah dibayar");
      queryClient.invalidateQueries({ queryKey });
      onSlipChanged?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [type, setType] = useState<"BONUS" | "DENDA" | "POTONGAN">("BONUS");
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState<number | undefined>(undefined);

  const addManual = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/payroll/runs/${slip.runId}/slips/${slip.id}/manual-entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, label, amount }),
      });
      const json = (await res.json()) as ApiResponse;
      if (!res.ok) throw new Error(json.message ?? "Gagal menambah penyesuaian");
      return json;
    },
    onSuccess: (json) => {
      applyResult(json);
      toast.success("Penyesuaian manual ditambahkan");
      setLabel("");
      setAmount(undefined);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeManual = useMutation({
    mutationFn: async (entryId: string) => {
      const res = await fetch(
        `/api/payroll/runs/${slip.runId}/slips/${slip.id}/manual-entries/${entryId}`,
        { method: "DELETE" }
      );
      const json = (await res.json()) as ApiResponse;
      if (!res.ok) throw new Error(json.message ?? "Gagal menghapus penyesuaian");
      return json;
    },
    onSuccess: (json) => {
      applyResult(json);
      toast.success("Penyesuaian manual dihapus");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleAdd = () => {
    if (!label.trim()) {
      toast.error("Alasan wajib diisi");
      return;
    }
    if (!amount || amount <= 0) {
      toast.error("Nominal harus lebih dari 0");
      return;
    }
    addManual.mutate();
  };

  const tglBayar = slip.paidAt
    ? new Date(slip.paidAt).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  const bisaAksi = canManage && !slip.paidAt && !runTerkunci;
  const totalPengurangan = slip.totalPenalty + slip.totalDeduction;

  // Entri komponen gaji (Uang Makan, Uang Transport, …) tampil di section
  // "Komponen gaji", bukan bercampur dengan bonus dan denda.
  const entriKomponen = slip.entries.filter((e) => e.source === "COMPONENT");
  const entriPenyesuaian = slip.entries.filter((e) => e.source !== "COMPONENT");
  // Sisa tunjangan yang BUKAN dari entri komponen (mis. tunjangan manual atau
  // hasil rule) — supaya baris agregat di bawah tidak mengulang angka yang
  // sudah dirinci satu per satu di atasnya.
  const tunjanganLain =
    slip.totalAllowance -
    entriKomponen
      .filter((e) => e.status === "APPLIED" && e.type === "TUNJANGAN")
      .reduce((s, e) => s + e.amount, 0);
  // Periode slip ditulis di setiap judul section, bukan "bulan ini". Komponen
  // ini dipakai juga di panel run dan halaman payroll karyawan, jadi "bulan
  // ini" bisa berarti bulan berjalan bagi pembacanya — padahal yang dimaksud
  // selalu periode slip yang sedang dibuka.
  const periodeLabel = `${MONTH_NAMES[slip.periodMonth]} ${slip.periodYear}`;

  return (
    <div className="space-y-8">
      {/* ── Sorotan angka ────────────────────────────────────────────────── */}
      <MetricRow columns={4}>
        <MetricBlock label="Gaji kotor" prefix="Rp" value={formatAmount(slip.grossPay)} />
        <MetricBlock
          label="Bonus"
          prefix="Rp"
          tone={slip.totalBonus > 0 ? "success" : "muted"}
          value={formatAmount(slip.totalBonus)}
        />
        <MetricBlock
          label="Potongan & denda"
          prefix="Rp"
          tone={totalPengurangan > 0 ? "destructive" : "muted"}
          value={formatAmount(totalPengurangan)}
        />
        <MetricBlock
          label="Diterima"
          prefix="Rp"
          size="secondary"
          value={formatAmount(slip.netPay)}
          meta={
            <>
              {STATUS_LABEL[slip.runStatus] ?? slip.runStatus}
              {tglBayar ? ` · Dibayar ${tglBayar}` : ""}
            </>
          }
        />
      </MetricRow>

      {slip.needsReview && (
        <Alert>
          <IconAlertTriangle className="size-4" />
          <AlertDescription>
            Ada rule yang tidak menghasilkan angka pada slip ini — periksa rinciannya di bawah
            sebelum dibayar.
          </AlertDescription>
        </Alert>
      )}

      {/* ── Dua kolom: alasan di kiri, angka di kanan ────────────────────── */}
      <div className="grid grid-cols-1 items-start gap-8 xl:grid-cols-[minmax(0,1fr)_340px] xl:gap-12">
        {/* ── Kolom kiri ───────────────────────────────────────────────── */}
        <div className="min-w-0 space-y-10">
          <section className="space-y-2">
            <SectionTitle hint={`${entriPenyesuaian.length} entri`}>
              Rincian bonus, denda &amp; potongan
            </SectionTitle>

            {entriPenyesuaian.length === 0 ? (
              <p className="text-muted-foreground py-6 text-sm">
                Belum ada bonus, denda, atau potongan pada slip ini.
              </p>
            ) : (
              <ul className="divide-border divide-y">
                {entriPenyesuaian.map((e) => {
                  const rows = asBreakdown(e.breakdown);
                  return (
                    <li key={e.id} className="flex items-start justify-between gap-4 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={
                              e.status === "APPLIED"
                                ? "text-sm text-pretty"
                                : "text-muted-foreground text-sm text-pretty"
                            }
                          >
                            {e.label}
                          </span>
                          <Badge variant="soft" className="text-[10px]">
                            {TYPE_LABEL[e.type] ?? e.type}
                          </Badge>
                          <Badge
                            variant={e.source === "MANUAL" ? "info" : "outline"}
                            className="text-[10px]"
                          >
                            {SOURCE_LABEL[e.source] ?? e.source}
                          </Badge>
                          {e.status !== "APPLIED" && (
                            <Badge variant="outline" className="text-[10px]">
                              {e.status === "ERROR" ? "gagal" : "dilewati"}
                            </Badge>
                          )}
                        </div>
                        {rows && <EntryBreakdown rows={rows} />}
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span
                          className={`tabular text-sm font-medium ${
                            e.status !== "APPLIED" || e.amount === 0
                              ? "text-muted-foreground"
                              : e.amount > 0
                                ? "text-success"
                                : "text-destructive"
                          }`}
                        >
                          {e.status !== "APPLIED"
                            ? "—"
                            : `${e.amount >= 0 ? "+" : "−"}${formatCurrency(Math.abs(e.amount))}`}
                        </span>
                        {canManage && e.source === "MANUAL" && slip.canEdit && (
                          <DeleteConfirmDialog
                            title="Hapus penyesuaian ini?"
                            description={`"${e.label}" akan dihapus dari slip dan tidak ikut dihitung lagi.`}
                            loading={removeManual.isPending}
                            onConfirm={() => removeManual.mutate(e.id)}
                            trigger={
                              <Button variant="ghost" size="icon" className="size-7">
                                <IconTrash className="text-muted-foreground size-3.5" />
                              </Button>
                            }
                          />
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* ── KPI bulan ini ──────────────────────────────────────────── */}
          <section className="space-y-3">
            <SectionTitle hint="Skor saja — bonus/dendanya lahir dari rule di atas">
              KPI {periodeLabel}
            </SectionTitle>
            <SlipKpiSection
              userId={slip.userId}
              month={slip.periodMonth}
              year={slip.periodYear}
            />
          </section>

          {/* ── Kehadiran bulanan ──────────────────────────────────────── */}
          <section className="space-y-3">
            <SectionTitle hint="Arahkan kursor ke satu bar untuk melihat tanggal & jam masuk">
              Kehadiran {periodeLabel}
            </SectionTitle>
            <AttendanceMonthStrip
              userId={slip.userId}
              month={slip.periodMonth}
              year={slip.periodYear}
              joinDate={slip.joinDate}
            />
          </section>

          {/* ── Tambah penyesuaian manual ──────────────────────────────── */}
          {canManage && (
            <section className="space-y-3">
              <SectionTitle>Tambah penyesuaian manual</SectionTitle>
              <p className="text-muted-foreground max-w-2xl text-sm text-pretty">
                Bonus atau pengurangan tambahan di luar rule reward &amp; denda yang sudah ada —
                mis. bonus proyek khusus atau potongan kasus tertentu. Alasan wajib diisi dan akan
                tampil di slip.
              </p>

              {!slip.canEdit ? (
                <Alert>
                  <IconAlertTriangle className="size-4" />
                  <AlertDescription>
                    Slip ini sudah tidak bisa diubah (
                    {STATUS_LABEL[slip.runStatus] ?? slip.runStatus}).
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-[140px_1fr_180px_auto] sm:items-end">
                  <div className="grid gap-1.5">
                    <Label>Tipe</Label>
                    <Combobox
                      value={type}
                      onValueChange={(v) => setType(v as "BONUS" | "DENDA" | "POTONGAN")}
                      options={[
                        { value: "BONUS", label: "Bonus" },
                        { value: "DENDA", label: "Denda" },
                        { value: "POTONGAN", label: "Potongan / Utang" },
                      ]}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Alasan *</Label>
                    <Input
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                      placeholder="mis. Bonus proyek renovasi cabang"
                      maxLength={200}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Nominal *</Label>
                    <NumberInput
                      value={amount ?? ""}
                      onValueChange={setAmount}
                      placeholder="0"
                      prefix="Rp "
                    />
                  </div>
                  <Button onClick={handleAdd} disabled={addManual.isPending}>
                    <IconPlus className="size-4" />
                    Tambah
                  </Button>
                </div>
              )}
            </section>
          )}
        </div>

        {/* ── Kolom kanan ──────────────────────────────────────────────── */}
        <aside className="space-y-6 xl:sticky xl:top-6">
          <section className="space-y-2">
            <SectionTitle>Komponen gaji</SectionTitle>
            <div className="divide-border divide-y">
              <ComponentLine label="Gaji Pokok" value={slip.baseSalary} />
              <ComponentLine label="Uang Makan" value={slip.mealAllowance} />
              <ComponentLine label="Uang Transport" value={slip.transportAllowance} />
              <ComponentLine label="Uang Jabatan" value={slip.positionAllowance} />
              <ComponentLine label="BPJS Kesehatan" value={slip.bpjsKesehatan} />
              {entriKomponen.map((e) => (
                <ComponentEntryLine key={e.id} entry={e} />
              ))}
              <ComponentLine label="Tunjangan Tambahan" value={tunjanganLain} />
            </div>
          </section>

          <section className="space-y-2 border-t pt-4">
            <SectionTitle>Rekap</SectionTitle>
            <div className="divide-border divide-y">
              <RecapLine label="Gaji kotor" value={slip.grossPay} />
              <RecapLine label="Bonus" value={slip.totalBonus} tone="success" />
              <RecapLine label="Potongan & denda" value={totalPengurangan} tone="destructive" />
              <RecapLine label="Diterima" value={slip.netPay} strong />
            </div>
          </section>

          <section className="space-y-3 border-t pt-4">
            <SectionTitle>Status</SectionTitle>
            <p className="text-sm">
              {STATUS_LABEL[slip.runStatus] ?? slip.runStatus}
              {tglBayar && (
                <span className="text-muted-foreground"> · dibayar {tglBayar}</span>
              )}
              {slip.paidByName && (
                <span className="text-muted-foreground"> oleh {slip.paidByName}</span>
              )}
            </p>

            {bisaAksi && (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={recalculate.isPending || markPaid.isPending}
                  onClick={() => recalculate.mutate()}
                >
                  <IconRefresh className="size-4" />
                  Hitung ulang
                </Button>
                <Button
                  size="sm"
                  disabled={recalculate.isPending || markPaid.isPending}
                  onClick={() => markPaid.mutate()}
                >
                  <IconCoin className="size-4" />
                  Tandai Sudah Bayar
                </Button>
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
