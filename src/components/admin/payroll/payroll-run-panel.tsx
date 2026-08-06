"use client";

// Penggajian satu bulan untuk satu PT: daftar SEMUA karyawan aktif, ditandai
// mana yang sudah dihitung dan mana yang belum → klik baris yang sudah
// dihitung untuk membuka halaman detail slipnya, klik yang belum untuk
// Hitung.
//
// Daftarnya digabung dari dua sumber: roster karyawan aktif PT ini (prop
// `users`, dihitung server-side) dan slip yang sudah tersimpan di run
// berjalan (`run.slips`). Karyawan yang belum punya slip tetap tampil
// sebagai baris "Belum Dihitung" — bukan hilang sampai run pertama dibuat.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Combobox } from "@/components/ui/combobox";
import { MetricBlock, MetricRow, EmptyState } from "@/components/admin/page-shell";
import { MONTH_NAMES, formatCurrency } from "@/lib/kpi-utils";
import type { PayrollRunView, PayrollSlipView } from "@/app/api/payroll/runs/serialize";
import type { UserRow } from "@/components/admin/payroll/payroll-page-client";

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

export function PayrollRunPanel({
  companies,
  users,
  locale,
}: {
  companies: CompanyOption[];
  /** Roster lengkap yang boleh dilihat pemanggil (lintas PT) — disaring ke PT
   *  terpilih di bawah, supaya daftar tetap menampilkan karyawan yang belum
   *  punya slip sama sekali. */
  users: UserRow[];
  locale: string;
}) {
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

  const hitungSemua = useMutation({
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
      toast.success(`Gaji ${MONTH_NAMES[month]} ${year} selesai dihitung`);
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bayarSemua = useMutation({
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
  const sibuk = hitungSemua.isPending || bayarSemua.isPending;
  const sudahDibayar = run?.status === "PAID";
  // Sebagian sudah dibayar per orang — generate ulang akan mengunci ini di
  // server juga, tapi tombolnya dimatikan di sini supaya errornya tidak
  // perlu terjadi dulu baru terlihat.
  const adaYangSudahDibayar = run?.slips.some((s) => s.paidAt) ?? false;

  const label = `${MONTH_NAMES[month]} ${year}`;

  const roster = users.filter((u) => u.isActive && u.companyId === companyId);

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
            <Combobox
              value={companyId}
              onValueChange={setCompanyId}
              options={companies.map((c) => ({ value: c.id, label: c.name }))}
              placeholder="Pilih PT"
              searchPlaceholder="Cari PT..."
              className="w-48"
            />
          )}

          {!bulanDepan && !sudahDibayar && (
            <Button
              variant={run ? "outline" : "default"}
              disabled={sibuk || !companyId || adaYangSudahDibayar}
              title={
                adaYangSudahDibayar
                  ? "Sudah ada karyawan yang dibayar pada run ini, tidak bisa dihitung ulang seluruhnya"
                  : undefined
              }
              onClick={() => hitungSemua.mutate()}
            >
              <IconRefresh className="size-4" />
              {run ? "Hitung ulang semua" : "Hitung Semua Karyawan"}
            </Button>
          )}

          {run && !sudahDibayar && (
            <Button disabled={sibuk} onClick={() => bayarSemua.mutate(run.id)}>
              Bayar Semua
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
          <div className="divide-border divide-y rounded-md border">
            {(roster.length > 0 ? roster : Array.from({ length: 4 })).map((u, i) => (
              <Skeleton key={(u as UserRow)?.id ?? i} className="h-14 w-full rounded-none" />
            ))}
          </div>
        </div>
      ) : roster.length === 0 ? (
        <EmptyState
          title="Tidak ada karyawan aktif"
          description="PT ini belum punya karyawan aktif untuk dihitung gajinya."
        />
      ) : (
        <RosterList
          run={run}
          roster={roster}
          month={month}
          year={year}
          bulanDepan={bulanDepan}
          queryKey={queryKey}
          locale={locale}
        />
      )}
    </section>
  );
}

function RosterList({
  run,
  roster,
  month,
  year,
  bulanDepan,
  queryKey,
  locale,
}: {
  run: PayrollRunView | null;
  roster: UserRow[];
  month: number;
  year: number;
  bulanDepan: boolean;
  queryKey: QueryKey;
  locale: string;
}) {
  const slipByUserId = new Map((run?.slips ?? []).map((s) => [s.userId, s] as const));
  const jumlahDihitung = run?.slips.length ?? 0;
  const sudahDibayarCount = run?.slips.filter((s) => s.paidAt).length ?? 0;

  const tglBayar = run?.paidAt
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
          label="Karyawan dihitung"
          value={`${jumlahDihitung}/${roster.length}`}
          meta={run ? `${sudahDibayarCount}/${jumlahDihitung} sudah dibayar` : "Belum ada yang dihitung"}
        />
        <MetricBlock
          label="Total dibayarkan"
          value={formatCurrency(run?.totalNetPay ?? 0)}
          size="secondary"
          meta={run ? STATUS_LABEL[run.status] ?? run.status : "—"}
        />
        <MetricBlock
          label="Perlu diperiksa"
          value={run?.jumlahPerluReview ?? 0}
          size="secondary"
          tone={(run?.jumlahPerluReview ?? 0) > 0 ? "warning" : "default"}
          meta={
            !run
              ? undefined
              : run.jumlahPerluReview > 0
                ? "Ada rule yang tidak menghasilkan angka"
                : "Semua rule berjalan normal"
          }
        />
        <MetricBlock
          label="Dihitung"
          value={
            run
              ? new Date(run.generatedAt).toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : bulanDepan
                ? "Bulan depan"
                : "Belum dihitung"
          }
          size="secondary"
          meta={tglBayar ? `Dibayar ${tglBayar}` : run?.rulesetHash ? `Rule ${run.rulesetHash.slice(0, 8)}` : undefined}
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
          {roster.map((user) => (
            <RosterRow
              key={user.id}
              user={user}
              slip={slipByUserId.get(user.id) ?? null}
              month={month}
              year={year}
              bulanDepan={bulanDepan}
              queryKey={queryKey}
              locale={locale}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * Satu baris karyawan — entah sudah punya slip tersimpan atau belum.
 *
 * Kalau sudah dihitung, seluruh baris jadi tautan ke halaman detail slip —
 * rinciannya tidak lagi dibuka inline. Kalau belum, klik baris membuka tombol
 * Hitung; sengaja tidak otomatis terhitung begitu baris dibuka.
 */
function RosterRow({
  user,
  slip,
  month,
  year,
  bulanDepan,
  queryKey,
  locale,
}: {
  user: UserRow;
  slip: PayrollSlipView | null;
  month: number;
  year: number;
  bulanDepan: boolean;
  queryKey: QueryKey;
  locale: string;
}) {
  const router = useRouter();
  const [terbuka, setTerbuka] = useState(false);
  const queryClient = useQueryClient();
  const slipHref = slip ? `/${locale}/dashboard/payroll/slip/${slip.id}` : null;

  const hitung = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/payroll/slip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: user.id, month, year }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? "Gagal menghitung gaji");
      return json;
    },
    onSuccess: () => {
      toast.success(`Gaji ${user.name} berhasil dihitung`);
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <TableRow
        className="cursor-pointer"
        onClick={() => (slipHref ? router.push(slipHref) : setTerbuka((v) => !v))}
      >
        <TableCell>
          <div className="flex items-center gap-2">
            {slipHref ? (
              <Link
                href={slipHref}
                onClick={(e) => e.stopPropagation()}
                className="hover:text-primary font-medium hover:underline"
              >
                {user.name}
              </Link>
            ) : (
              <span className="font-medium">{user.name}</span>
            )}
            {slip?.needsReview && (
              <IconAlertTriangle
                className="text-warning size-3.5 shrink-0"
                aria-label="Perlu diperiksa"
              />
            )}
            {slip?.paidAt ? (
              <Badge variant="secondary" className="gap-1 px-1.5 py-0 text-[10px]">
                <IconCheck className="size-3" />
                Dibayar
              </Badge>
            ) : slip ? (
              <Badge variant="soft" className="px-1.5 py-0 text-[10px]">
                Sudah Dihitung
              </Badge>
            ) : (
              <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                Belum Dihitung
              </Badge>
            )}
          </div>
          <div className="text-muted-foreground text-xs">
            {user.role} · {user.branchName}
          </div>
        </TableCell>
        <TableCell className="tabular text-right">
          {slip ? formatCurrency(slip.grossPay) : "—"}
        </TableCell>
        <TableCell className="tabular text-right">
          {slip && slip.totalBonus > 0 ? formatCurrency(slip.totalBonus) : "—"}
        </TableCell>
        <TableCell className="tabular text-right">
          {slip && slip.totalPenalty > 0 ? formatCurrency(slip.totalPenalty) : "—"}
        </TableCell>
        <TableCell className="tabular text-right">
          {slip && slip.totalDeduction > 0 ? formatCurrency(slip.totalDeduction) : "—"}
        </TableCell>
        <TableCell className="tabular text-right font-semibold">
          {slip ? formatCurrency(slip.netPay) : "—"}
        </TableCell>
      </TableRow>

      {terbuka && !slip && (
        <TableRow>
          <TableCell colSpan={6} className="bg-muted/30">
            <div
              className="flex flex-col items-start gap-3 py-4"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-muted-foreground text-sm">
                Gaji {user.name} untuk periode ini belum dihitung.
                {bulanDepan &&
                  " Bulan ini belum berjalan — presensi dan KPI-nya belum lengkap."}
              </p>
              <Button
                size="sm"
                disabled={hitung.isPending || bulanDepan}
                onClick={() => hitung.mutate()}
              >
                {hitung.isPending ? "Menghitung..." : "Hitung & Simpan Gaji"}
              </Button>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
