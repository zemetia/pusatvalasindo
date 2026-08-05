"use client";

// Detail gaji satu karyawan untuk satu bulan — dasar dari PayrollSlip yang
// tersimpan (bukan kalkulator ad hoc). Di sinilah HR menambah penyesuaian
// manual (bonus/pengurangan) di luar rule reward & denda, dengan alasan
// wajib tertulis (PayrollSlipEntry.source = MANUAL).

import { useState } from "react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { IconPlus, IconTrash, IconAlertTriangle } from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { MetricBlock, MetricRow } from "@/components/admin/page-shell";
import { AttendanceMonthCalendar } from "@/components/admin/payroll/attendance-month-calendar";
import { formatCurrency, formatAmount } from "@/lib/kpi-utils";
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

async function readError(res: Response) {
  const json = await res.json().catch(() => null);
  return json?.message ?? "Terjadi kesalahan";
}

export function PayrollSlipDetailClient({
  slip: initialSlip,
  canManage,
}: {
  slip: PayrollSlipDetailView;
  canManage: boolean;
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
  };

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
    ? new Date(slip.paidAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <div className="space-y-8">
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
          tone={slip.totalPenalty + slip.totalDeduction > 0 ? "destructive" : "muted"}
          value={formatAmount(slip.totalPenalty + slip.totalDeduction)}
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

      {/* ── Rincian ──────────────────────────────────────────────────── */}
      <section className="space-y-1">
        <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Rincian gaji
        </h2>
        <ul className="divide-border divide-y">
          {slip.entries.map((e) => (
            <li key={e.id} className="flex items-start justify-between gap-4 py-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={e.status === "APPLIED" ? "text-sm" : "text-muted-foreground text-sm"}>
                    {e.label}
                  </span>
                  <Badge variant="soft" className="text-[10px]">
                    {TYPE_LABEL[e.type] ?? e.type}
                  </Badge>
                  <Badge variant={e.source === "MANUAL" ? "info" : "outline"} className="text-[10px]">
                    {SOURCE_LABEL[e.source] ?? e.source}
                  </Badge>
                  {e.status !== "APPLIED" && (
                    <Badge variant="outline" className="text-[10px]">
                      {e.status === "ERROR" ? "gagal" : "dilewati"}
                    </Badge>
                  )}
                </div>
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
          ))}
        </ul>
      </section>

      {/* ── Kehadiran bulanan ────────────────────────────────────────── */}
      <section className="space-y-2 border-t pt-6">
        <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Kehadiran Bulan Ini
        </h2>
        <AttendanceMonthCalendar
          userId={slip.userId}
          month={slip.periodMonth}
          year={slip.periodYear}
        />
      </section>

      {/* ── Tambah penyesuaian manual ────────────────────────────────── */}
      {canManage && (
        <section className="space-y-3 border-t pt-6">
          <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Tambah penyesuaian manual
          </h2>
          <p className="text-muted-foreground text-sm text-pretty">
            Bonus atau pengurangan tambahan di luar rule reward &amp; denda yang sudah ada — mis.
            bonus proyek khusus atau potongan kasus tertentu. Alasan wajib diisi dan akan tampil
            di slip.
          </p>

          {!slip.canEdit ? (
            <Alert>
              <IconAlertTriangle className="size-4" />
              <AlertDescription>
                Slip ini sudah tidak bisa diubah ({STATUS_LABEL[slip.runStatus] ?? slip.runStatus}).
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[140px_1fr_180px_auto] sm:items-end">
              <div className="grid gap-1.5">
                <Label>Tipe</Label>
                <Select
                  value={type}
                  onValueChange={(v) => setType(v as "BONUS" | "DENDA" | "POTONGAN")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BONUS">Bonus</SelectItem>
                    <SelectItem value="DENDA">Denda</SelectItem>
                    <SelectItem value="POTONGAN">Potongan / Utang</SelectItem>
                  </SelectContent>
                </Select>
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
  );
}
