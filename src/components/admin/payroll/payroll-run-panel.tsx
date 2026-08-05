"use client";

// Penggajian satu bulan untuk satu PT: pilih bulan → Hitung → Bayar.
//
// Berbeda dari kalkulator per karyawan di bawahnya, panel ini MENYIMPAN
// hasilnya sebagai PayrollRun beserta seluruh slip dan alasannya. Itulah yang
// membuat gaji bulan lampau masih bisa dibuka dan dijelaskan angka per angka.

import { useState } from "react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  IconAlertTriangle,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconRefresh,
} from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { MetricBlock, MetricRow, EmptyState } from "@/components/admin/page-shell";
import { MONTH_NAMES, formatCurrency } from "@/lib/kpi-utils";
import type { PayrollRunView, PayrollSlipView } from "@/app/api/payroll/runs/serialize";

type CompanyOption = { id: string; name: string; code: string };

type RunResponse = {
  run: PayrollRunView | null;
  attempts: {
    id: string;
    attempt: number;
    status: string;
    generatedAt: string;
    paidAt: string | null;
    jumlahSlip: number;
  }[];
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Belum dibayar",
  FINALIZED: "Siap dibayar",
  PAID: "Sudah dibayar",
  VOID: "Digantikan",
};

function periodeSekarang() {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

/** Satu bulan mundur/maju, tanpa membuat bulan 0 atau 13. */
function geser(month: number, year: number, arah: -1 | 1) {
  const i = month - 1 + arah;
  return { month: ((i % 12) + 12) % 12 + 1, year: year + Math.floor(i / 12) };
}

export function PayrollRunPanel({ companies }: { companies: CompanyOption[] }) {
  const kini = periodeSekarang();
  const [{ month, year }, setPeriode] = useState(kini);
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const queryClient = useQueryClient();

  // Bulan yang belum berjalan tidak bisa dihitung — presensi dan KPI-nya belum
  // lengkap, dan angka yang dihasilkan hanya akan menyesatkan.
  const bulanDepan = year > kini.year || (year === kini.year && month > kini.month);

  const queryKey = ["payroll-run", companyId, month, year] as const;

  const { data, isLoading } = useQuery<RunResponse>({
    queryKey,
    enabled: Boolean(companyId),
    queryFn: async () => {
      const res = await fetch(
        `/api/payroll/runs?companyId=${encodeURIComponent(companyId)}&month=${month}&year=${year}`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Gagal memuat data gaji");
      return json.data as RunResponse;
    },
  });

  const hitung = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/payroll/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, month, year }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Gagal menghitung gaji");
      return json;
    },
    onSuccess: () => {
      toast.success(`Gaji ${MONTH_NAMES[month - 1]} ${year} selesai dihitung`);
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bayar = useMutation({
    mutationFn: async (runId: string) => {
      const res = await fetch(`/api/payroll/runs/${runId}/pay`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Gagal menandai sudah dibayar");
      return json;
    },
    onSuccess: () => {
      toast.success("Gaji ditandai sudah dibayar");
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const run = data?.run ?? null;
  const sibuk = hitung.isPending || bayar.isPending;
  const sudahDibayar = run?.status === "PAID";

  const label = `${MONTH_NAMES[month - 1]} ${year}`;

  return (
    <section className="space-y-6">
      {/* ── Navigasi periode ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Bulan sebelumnya"
            onClick={() => setPeriode(geser(month, year, -1))}
          >
            <IconChevronLeft className="size-4" />
          </Button>
          <span className="min-w-40 text-center text-lg font-semibold tabular">{label}</span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Bulan berikutnya"
            onClick={() => setPeriode(geser(month, year, 1))}
          >
            <IconChevronRight className="size-4" />
          </Button>
          {(month !== kini.month || year !== kini.year) && (
            <Button variant="ghost" size="sm" onClick={() => setPeriode(kini)}>
              Bulan ini
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {companies.length > 1 && (
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Pilih PT" />
              </SelectTrigger>
              <SelectContent>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {run && !sudahDibayar && (
            <Button
              variant="outline"
              disabled={sibuk || bulanDepan}
              onClick={() => hitung.mutate()}
            >
              <IconRefresh className="size-4" />
              Hitung ulang
            </Button>
          )}

          {run && !sudahDibayar && (
            <Button disabled={sibuk} onClick={() => bayar.mutate(run.id)}>
              Bayar
            </Button>
          )}

          {sudahDibayar && (
            <Badge variant="secondary" className="gap-1.5 px-3 py-1.5">
              <IconCheck className="size-3.5" />
              Sudah dibayar
            </Badge>
          )}
        </div>
      </div>

      {/* ── Isi ──────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : !run ? (
        <EmptyState
          title={`Gaji ${label} belum dihitung`}
          description={
            bulanDepan
              ? "Bulan ini belum berjalan. Presensi dan KPI-nya belum lengkap, jadi belum bisa dihitung."
              : "Tekan Hitung untuk menjalankan seluruh rule reward & denda pada periode ini. Hasilnya tersimpan dan bisa dibuka lagi kapan pun."
          }
          action={
            !bulanDepan && (
              <Button disabled={sibuk || !companyId} onClick={() => hitung.mutate()}>
                Hitung gaji {label}
              </Button>
            )
          }
        />
      ) : (
        <RunDetail run={run} />
      )}
    </section>
  );
}

function RunDetail({ run }: { run: PayrollRunView }) {
  const tglBayar = run.paidAt
    ? new Date(run.paidAt).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="space-y-8">
      <MetricRow columns={4}>
        <MetricBlock
          label="Total dibayarkan"
          value={formatCurrency(run.totalNetPay)}
          meta={`${run.slips.length} karyawan`}
        />
        <MetricBlock
          label="Status"
          value={STATUS_LABEL[run.status] ?? run.status}
          size="secondary"
          meta={tglBayar ? `Dibayar ${tglBayar}` : `Perhitungan ke-${run.attempt}`}
        />
        <MetricBlock
          label="Perlu diperiksa"
          value={run.jumlahPerluReview}
          size="secondary"
          tone={run.jumlahPerluReview > 0 ? "warning" : "default"}
          meta={
            run.jumlahPerluReview > 0
              ? "Ada rule yang tidak menghasilkan angka"
              : "Semua rule berjalan normal"
          }
        />
        <MetricBlock
          label="Dihitung"
          value={new Date(run.generatedAt).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
          size="secondary"
          meta={run.rulesetHash ? `Rule ${run.rulesetHash.slice(0, 8)}` : undefined}
        />
      </MetricRow>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Karyawan</TableHead>
            <TableHead className="text-right">Gaji kotor</TableHead>
            <TableHead className="text-right">Bonus</TableHead>
            <TableHead className="text-right">Denda</TableHead>
            <TableHead className="text-right">Potongan</TableHead>
            <TableHead className="text-right">Diterima</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {run.slips.map((slip) => (
            <SlipRow key={slip.id} slip={slip} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * Satu baris slip, bisa dibuka untuk melihat alasannya.
 *
 * Rincian yang muncul di sini persis isi PayrollSlipEntry — termasuk entri yang
 * TIDAK menghasilkan uang. Slip harus bisa menjawab "kenapa bonus saya tidak
 * keluar bulan ini", bukan hanya menampilkan yang keluar.
 */
function SlipRow({ slip }: { slip: PayrollSlipView }) {
  const [terbuka, setTerbuka] = useState(false);

  return (
    <>
      <TableRow className="cursor-pointer" onClick={() => setTerbuka((v) => !v)}>
        <TableCell>
          <div className="flex items-center gap-2">
            <span className="font-medium">{slip.employeeName}</span>
            {slip.needsReview && (
              <IconAlertTriangle
                className="text-warning size-3.5 shrink-0"
                aria-label="Perlu diperiksa"
              />
            )}
          </div>
          <div className="text-muted-foreground text-xs">
            {slip.roleName} · {slip.branchName}
          </div>
        </TableCell>
        <TableCell className="tabular text-right">{formatCurrency(slip.grossPay)}</TableCell>
        <TableCell className="tabular text-right">
          {slip.totalBonus > 0 ? formatCurrency(slip.totalBonus) : "—"}
        </TableCell>
        <TableCell className="tabular text-right">
          {slip.totalPenalty > 0 ? formatCurrency(slip.totalPenalty) : "—"}
        </TableCell>
        <TableCell className="tabular text-right">
          {slip.totalDeduction > 0 ? formatCurrency(slip.totalDeduction) : "—"}
        </TableCell>
        <TableCell className="tabular text-right font-semibold">
          {formatCurrency(slip.netPay)}
        </TableCell>
      </TableRow>

      {terbuka && (
        <TableRow>
          <TableCell colSpan={6} className="bg-muted/30">
            <ul className="divide-border divide-y">
              {slip.entries.map((e) => (
                <li key={e.id} className="flex items-baseline justify-between gap-4 py-2">
                  <div className="min-w-0">
                    <span className={e.status === "APPLIED" ? "" : "text-muted-foreground"}>
                      {e.label}
                    </span>
                    {e.status !== "APPLIED" && (
                      <Badge variant="outline" className="ml-2 text-[10px]">
                        {e.status === "ERROR" ? "gagal" : "dilewati"}
                        {e.flag ? ` · ${e.flag}` : ""}
                      </Badge>
                    )}
                  </div>
                  <span className="tabular shrink-0 text-sm">
                    {e.amount === 0 ? "—" : formatCurrency(e.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
