"use client";

// Penggajian satu bulan untuk satu PT: lihat kehadiran → Hitung → Bayar.
//
// Berbeda dari kalkulator per karyawan di bawahnya, panel ini MENYIMPAN
// hasilnya sebagai PayrollRun beserta seluruh slip dan alasannya. Itulah yang
// membuat gaji bulan lampau masih bisa dibuka dan dijelaskan angka per angka.

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import {
  IconAlertTriangle,
  IconCalendarStats,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconCoin,
  IconReceipt,
  IconRefresh,
} from "@tabler/icons-react";

import { AttendanceHistory } from "@/components/attendance/attendance-history";
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
import type { AttendanceSummaryRow } from "@/app/api/payroll/attendance-summary/route";
import type { Attendance } from "@src/generated/prisma";

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

/** Label & pengelompokan kolom rekap kehadiran — dijaga tetap ringkas, sisanya digabung ke "Lainnya". */
const ATTENDANCE_COLUMNS: { key: string; label: string }[] = [
  { key: "PRESENT", label: "Hadir" },
  { key: "LATE", label: "Telat" },
  { key: "SICK", label: "Sakit" },
  { key: "PERMISSION", label: "Izin" },
  { key: "ABSENT", label: "Alpha" },
];

function periodeSekarang() {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

/** Satu bulan mundur/maju, tanpa membuat bulan 0 atau 13. */
function geser(month: number, year: number, arah: -1 | 1) {
  const i = month - 1 + arah;
  return { month: ((i % 12) + 12) % 12 + 1, year: year + Math.floor(i / 12) };
}

/**
 * Rekap kehadiran satu bulan untuk seluruh karyawan aktif PT terpilih.
 *
 * Ditampilkan terlepas dari sudah ada run gaji atau belum — gunanya justru
 * supaya HR bisa memeriksa kehadiran periode itu SEBELUM menekan Hitung.
 */
function AttendanceSummarySection({
  companyId,
  month,
  year,
}: {
  companyId: string;
  month: number;
  year: number;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["payroll-attendance-summary", companyId, month, year],
    enabled: Boolean(companyId),
    queryFn: async () => {
      const res = await fetch(
        `/api/payroll/attendance-summary?companyId=${encodeURIComponent(companyId)}&month=${month}&year=${year}`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? "Gagal memuat rekap kehadiran");
      return json.data as { rows: AttendanceSummaryRow[]; statuses: string[] };
    },
  });

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <IconCalendarStats className="text-muted-foreground size-4" />
        <h3 className="text-sm font-medium">
          Kehadiran {MONTH_NAMES[month - 1]} {year}
        </h3>
      </div>

      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : !data || data.rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Belum ada karyawan aktif atau catatan kehadiran untuk periode ini.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Karyawan</TableHead>
                {ATTENDANCE_COLUMNS.map((c) => (
                  <TableHead key={c.key} className="text-right">
                    {c.label}
                  </TableHead>
                ))}
                <TableHead className="text-right">Lainnya</TableHead>
                <TableHead className="text-right">Tercatat</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((r) => {
                const known = ATTENDANCE_COLUMNS.reduce(
                  (s, c) => s + (r.counts[c.key] ?? 0),
                  0
                );
                const lainnya = r.totalLogged - known;
                return (
                  <TableRow key={r.userId}>
                    <TableCell>
                      <span className="font-medium">{r.name}</span>
                      <div className="text-muted-foreground text-xs">
                        {r.roleName} · {r.branchName}
                      </div>
                    </TableCell>
                    {ATTENDANCE_COLUMNS.map((c) => {
                      const n = r.counts[c.key] ?? 0;
                      return (
                        <TableCell key={c.key} className="tabular text-right">
                          {n > 0 ? n : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                      );
                    })}
                    <TableCell className="tabular text-right">
                      {lainnya > 0 ? lainnya : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="tabular text-right font-medium">
                      {r.totalLogged}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}

export function PayrollRunPanel({
  companies,
  locale,
}: {
  companies: CompanyOption[];
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
  // Sebagian sudah dibayar per orang — generate ulang akan mengunci ini di
  // server juga, tapi tombolnya dimatikan di sini supaya errornya tidak
  // perlu terjadi dulu baru terlihat.
  const adaYangSudahDibayar = run?.slips.some((s) => s.paidAt) ?? false;

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
              disabled={sibuk || bulanDepan || adaYangSudahDibayar}
              title={
                adaYangSudahDibayar
                  ? "Sudah ada karyawan yang dibayar pada run ini, tidak bisa dihitung ulang seluruhnya"
                  : undefined
              }
              onClick={() => hitung.mutate()}
            >
              <IconRefresh className="size-4" />
              Hitung ulang
            </Button>
          )}

          {run && !sudahDibayar && (
            <Button disabled={sibuk} onClick={() => bayar.mutate(run.id)}>
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

      {/* ── Kehadiran bulanan ────────────────────────────────────────── */}
      {companyId && <AttendanceSummarySection companyId={companyId} month={month} year={year} />}

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
        <RunDetail run={run} queryKey={queryKey} locale={locale} />
      )}
    </section>
  );
}

function RunDetail({
  run,
  queryKey,
  locale,
}: {
  run: PayrollRunView;
  queryKey: QueryKey;
  locale: string;
}) {
  const tglBayar = run.paidAt
    ? new Date(run.paidAt).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  const sudahDibayar = run.slips.filter((s) => s.paidAt).length;

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
          meta={
            tglBayar
              ? `Dibayar ${tglBayar}`
              : sudahDibayar > 0
                ? `${sudahDibayar}/${run.slips.length} karyawan sudah dibayar`
                : `Perhitungan ke-${run.attempt}`
          }
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
            <SlipRow key={slip.id} run={run} slip={slip} queryKey={queryKey} locale={locale} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** Baris komponen tetap, dipakai di dalam detail slip yang dibuka. */
function ComponentLine({ label, value }: { label: string; value: number }) {
  if (value <= 0) return null;
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular">{formatCurrency(value)}</span>
    </div>
  );
}

/**
 * Kehadiran bulanan satu karyawan, dimuat hanya saat baris slipnya dibuka.
 *
 * Memakai `/api/attendance` (bukan endpoint baru) supaya aturan otorisasinya
 * — termasuk yang membedakan lihat presensi sendiri vs. orang lain — tetap
 * satu tempat.
 */
function SlipAttendance({
  userId,
  month,
  year,
}: {
  userId: string;
  month: number;
  year: number;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["attendance", userId, month, year],
    queryFn: async () => {
      const res = await fetch(`/api/attendance?userId=${userId}&month=${month}&year=${year}`);
      if (res.status === 403) return { forbidden: true as const, records: [] as Attendance[] };
      if (!res.ok) throw new Error("Gagal memuat presensi");
      const records = (await res.json()) as Attendance[];
      return { forbidden: false as const, records };
    },
  });

  if (isLoading) return <Skeleton className="h-24 w-full" />;
  if (!data || data.forbidden) {
    return (
      <p className="text-muted-foreground text-xs">
        Tidak punya akses melihat rincian presensi karyawan ini.
      </p>
    );
  }
  return <AttendanceHistory records={data.records} />;
}

/**
 * Satu baris slip, bisa dibuka untuk melihat data lengkap yang sudah
 * dihitung: rincian gaji, kehadiran bulanan, dan alasan tiap rule.
 *
 * Rincian entri yang muncul di sini persis isi PayrollSlipEntry — termasuk
 * entri yang TIDAK menghasilkan uang. Slip harus bisa menjawab "kenapa bonus
 * saya tidak keluar bulan ini", bukan hanya menampilkan yang keluar.
 */
function SlipRow({
  run,
  slip,
  queryKey,
  locale,
}: {
  run: PayrollRunView;
  slip: PayrollSlipView;
  queryKey: QueryKey;
  locale: string;
}) {
  const [terbuka, setTerbuka] = useState(false);
  const queryClient = useQueryClient();

  const runTerkunci = run.status === "PAID" || run.status === "VOID";

  const hitungUlang = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/payroll/runs/${run.id}/slips/${slip.id}/recalculate`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? "Gagal menghitung ulang slip");
      return json;
    },
    onSuccess: () => {
      toast.success(`Slip ${slip.employeeName} berhasil dihitung ulang`);
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bayarSlip = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/payroll/runs/${run.id}/slips/${slip.id}/pay`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? "Gagal menandai gaji sudah dibayar");
      return json;
    },
    onSuccess: () => {
      toast.success(`Gaji ${slip.employeeName} ditandai sudah dibayar`);
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sibuk = hitungUlang.isPending || bayarSlip.isPending;

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
            {slip.paidAt && (
              <Badge variant="secondary" className="gap-1 px-1.5 py-0 text-[10px]">
                <IconCheck className="size-3" />
                Dibayar
              </Badge>
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
          <TableCell colSpan={6} className="bg-muted/30 space-y-6">
            {/* Rincian gaji — komponen tetap yang membentuk gaji kotor */}
            <div>
              <p className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
                Rincian Gaji
              </p>
              <div className="divide-border divide-y">
                <ComponentLine label="Gaji Pokok" value={slip.baseSalary} />
                <ComponentLine label="Uang Makan" value={slip.mealAllowance} />
                <ComponentLine label="Uang Transport" value={slip.transportAllowance} />
                <ComponentLine label="Uang Jabatan" value={slip.positionAllowance} />
                <ComponentLine label="BPJS Kesehatan" value={slip.bpjsKesehatan} />
                <ComponentLine label="Tunjangan Tambahan" value={slip.totalAllowance} />
              </div>
            </div>

            {/* Reward, denda & potongan — satu baris per entri, termasuk yang di-skip */}
            {slip.entries.length > 0 && (
              <div>
                <p className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
                  Reward &amp; Potongan
                </p>
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
              </div>
            )}

            {/* Kehadiran bulanan karyawan ini */}
            <div>
              <p className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
                Kehadiran Bulan Ini
              </p>
              <SlipAttendance userId={slip.userId} month={run.periodMonth} year={run.periodYear} />
            </div>

            {/* Aksi per orang */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              {slip.paidAt ? (
                <p className="text-muted-foreground text-xs">
                  Dibayar {new Date(slip.paidAt).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                  {slip.paidByName ? ` oleh ${slip.paidByName}` : ""}
                </p>
              ) : (
                <span className="text-muted-foreground text-xs">Belum dibayar</span>
              )}

              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <Link href={`/${locale}/dashboard/payroll/slip/${slip.id}`}>
                  <Button variant="outline" size="sm">
                    <IconReceipt className="size-4" />
                    Detail &amp; penyesuaian manual
                  </Button>
                </Link>
                {!slip.paidAt && !runTerkunci && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={sibuk}
                      onClick={() => hitungUlang.mutate()}
                    >
                      <IconRefresh className="size-4" />
                      Hitung ulang
                    </Button>
                    <Button size="sm" disabled={sibuk} onClick={() => bayarSlip.mutate()}>
                      <IconCoin className="size-4" />
                      Bayar {slip.employeeName.split(" ")[0]}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
