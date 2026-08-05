"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { IconAlertCircle, IconInfoCircle } from "@tabler/icons-react";
import { MetricBlock } from "@/components/admin/page-shell";
import { PayrollSlipDetailClient } from "@/components/admin/payroll/payroll-slip-detail-client";
import type { PayrollSlipDetailView } from "@/app/api/payroll/runs/serialize";
import {
  MONTH_NAMES,
  SCORING_TYPE_LABELS,
  getGrade,
  formatCurrency,
  formatAmount,
  formatPercent,
  type PayrollResult,
} from "@/lib/kpi-utils";

export type UserRow = {
  id: string;
  name: string;
  role: string;
  branchName: string;
  /** PT karyawan, diturunkan dari cabangnya. Dipakai filter PT di bawah. */
  companyId: string | null;
  baseSalary: number | null;
  mealAllowance: number | null;
  transportAllowance: number | null;
  positionAllowance: number | null;
  bpjsKesehatan: number | null;
  isActive: boolean;
};

/** Warna badge rincian KPI: penalti = peringatan, reward = positif. */
function scoringTone(scoringType: string) {
  if (scoringType.startsWith("PENALTY") || scoringType === "TOLERANCE_LIMIT") return "warning";
  if (scoringType === "REWARD_POINT") return "success";
  return "info";
}

type CompanyOption = { id: string; name: string; code: string };

const ENTRY_TYPE_LABEL: Record<string, string> = {
  bonus: "Reward",
  denda: "Denda",
  potongan: "Potongan",
};

/**
 * Reward & punishment dari rule engine.
 *
 * Entri yang TIDAK menghasilkan uang ikut ditampilkan — itu bukan kelalaian.
 * Slip harus bisa menjelaskan kenapa sebuah rule tidak jalan (data presensi
 * belum lengkap, karyawan baru masuk, query rule error), bukan diam saja dan
 * membuat orang menebak. `inputs` yang menyertainya adalah angka-angka yang
 * dipakai engine, jadi selisih apa pun bisa ditunjukkan, bukan diperdebatkan.
 */
function RewardPunishmentSection({ rules }: { rules: PayrollResult["rules"] }) {
  if (rules.entries.length === 0) {
    return (
      <section className="border-border border-y py-8">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Reward & Punishment
        </p>
        <p className="text-muted-foreground mt-3 max-w-2xl text-sm text-pretty">
          Belum ada rule yang menyasar karyawan ini pada periode tersebut. Rule reward
          dan denda diatur lewat file di <code>config/payroll-rules/</code> dan bisa
          dilihat di halaman <strong>Rule Reward &amp; Denda</strong>.
        </p>
      </section>
    );
  }

  return (
    <section className="border-border border-y py-8">
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0 lg:[&>*:not(:first-child)]:border-l lg:[&>*:not(:first-child)]:pl-8 lg:[&>*:not(:last-child)]:pr-8">
        <MetricBlock
          label="Reward"
          prefix="Rp"
          tone={rules.totalBonus > 0 ? "success" : "muted"}
          value={formatAmount(rules.totalBonus)}
          meta="menambah gaji"
        />
        <MetricBlock
          label="Denda"
          prefix="Rp"
          tone={rules.totalPenalty > 0 ? "destructive" : "muted"}
          value={formatAmount(rules.totalPenalty)}
          meta="mengurangi gaji"
        />
        <MetricBlock
          label="Potongan"
          prefix="Rp"
          tone={rules.totalDeduction > 0 ? "destructive" : "muted"}
          value={formatAmount(rules.totalDeduction)}
          meta="mengurangi gaji"
        />
        <MetricBlock
          label="Dampak Bersih"
          prefix="Rp"
          tone={rules.netAmount > 0 ? "success" : rules.netAmount < 0 ? "destructive" : "muted"}
          value={formatAmount(rules.netAmount)}
          meta={`${rules.entries.length} rule dievaluasi`}
        />
      </div>

      {rules.needsReview && (
        <Alert className="mt-6">
          <IconAlertCircle className="size-4" />
          <AlertDescription>
            Ada rule yang tidak bisa dihitung penuh pada periode ini. Slip belum layak
            difinalkan sebelum baris bertanda di bawah diperiksa.
          </AlertDescription>
        </Alert>
      )}

      <ul className="mt-6 divide-y">
        {rules.entries.map((e) => (
          <li key={`${e.ruleId}@${e.ruleVersion}`} className="py-4">
            <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{e.label}</span>
                  <Badge variant={e.tipe === "bonus" ? "success" : "warning"}>
                    {ENTRY_TYPE_LABEL[e.tipe] ?? e.tipe}
                  </Badge>
                  {e.status !== "APPLIED" && (
                    <Badge variant={e.status === "ERROR" ? "danger" : "soft"}>
                      {e.status === "ERROR" ? "Gagal dihitung" : "Dilewati"}
                    </Badge>
                  )}
                  {e.flag && (
                    <Badge variant="soft" className="font-mono text-[11px]">
                      {e.flag}
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground mt-1 font-mono text-[11px]">
                  {e.ruleId} v{e.ruleVersion}
                  {e.tier ? ` · tier ${e.tier}` : ""}
                  {e.formula ? ` · ${e.formula}` : ""}
                </p>
              </div>
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
            </div>

            {(Object.keys(e.inputs).length > 0 || (e.breakdown?.length ?? 0) > 0) && (
              <details className="group mt-2">
                <summary className="text-muted-foreground hover:text-foreground cursor-pointer list-none text-xs">
                  <span className="group-open:hidden">Lihat angka yang dipakai</span>
                  <span className="hidden group-open:inline">Sembunyikan angka</span>
                </summary>

                <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1">
                  {Object.entries(e.inputs).map(([k, v]) => (
                    <div key={k} className="flex items-baseline gap-1.5">
                      <dt className="text-muted-foreground font-mono text-[11px]">{k}</dt>
                      <dd className="tabular text-xs font-medium">{String(v ?? "—")}</dd>
                    </div>
                  ))}
                </dl>

                {e.breakdown && e.breakdown.length > 0 && (
                  <ul className="mt-3 divide-y border-t">
                    {e.breakdown.map((b, i) => (
                      <li
                        key={i}
                        className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-1.5 text-xs"
                      >
                        <span className="tabular text-muted-foreground">{b.keterangan}</span>
                        <span className="min-w-0 flex-1 truncate px-2">{b.label}</span>
                        <span
                          className={`tabular font-medium ${
                            b.nominal === 0
                              ? "text-muted-foreground"
                              : b.nominal > 0
                                ? "text-success"
                                : "text-destructive"
                          }`}
                        >
                          {b.nominal >= 0 ? "+" : "−"}
                          {formatCurrency(Math.abs(b.nominal))}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </details>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function PayrollPageClient({
  users,
  companies,
}: {
  users: UserRow[];
  /**
   * PT yang boleh dikelola gajinya. Kosong berarti pemanggil hanya melihat slip
   * gajinya sendiri, sehingga filter PT tidak ditampilkan.
   */
  companies: CompanyOption[];
}) {
  const now = new Date();
  // Filter PT dulu, baru pilih orangnya — daftar karyawan lintas PT terlalu
  // panjang untuk dipilih langsung. "all" = semua PT dalam jangkauan.
  const [companyId, setCompanyId] = useState("all");
  const [userId, setUserId] = useState("");
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [result, setResult] = useState<PayrollResult | null>(null);

  const selectedUser = users.find((u) => u.id === userId);
  const queryClient = useQueryClient();

  // Menambah/menghapus penyesuaian manual, menghitung ulang, dan MENYIMPAN
  // hasil "Hitung" butuh `payroll.manage` write di PT karyawan itu. `companies`
  // yang diteruskan ke komponen ini sudah disaring server ke PT yang boleh
  // dikelola pemanggil, jadi keanggotaan di situ sudah cukup — tidak perlu cek
  // izin terpisah.
  const canManageSelected = Boolean(
    selectedUser && companies.some((c) => c.id === selectedUser.companyId)
  );

  const savedSlipQueryKey = ["payroll-saved-slip", userId, month, year] as const;

  /**
   * Begitu karyawan+periode dipilih, periksa dulu apakah gajinya SUDAH pernah
   * dihitung & tersimpan (lewat Run PT). Kalau sudah, langsung tampilkan —
   * tidak perlu menekan "Hitung" untuk sesuatu yang sudah punya jawaban.
   * Hanya kalau belum ada yang tersimpan, kalkulator di bawah dipakai.
   */
  const savedSlipQuery = useQuery<PayrollSlipDetailView | null>({
    queryKey: savedSlipQueryKey,
    enabled: Boolean(userId && month && year),
    queryFn: async () => {
      const res = await fetch(
        `/api/payroll/slip?employeeId=${encodeURIComponent(userId)}&month=${month}&year=${year}`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? "Gagal memeriksa slip tersimpan");
      return json.data.slip as PayrollSlipDetailView | null;
    },
  });
  const hasSavedSlip = Boolean(userId && savedSlipQuery.data);

  /**
   * Untuk yang berwenang mengelola gaji (HR): "Hitung" MENYIMPAN slipnya
   * (lewat POST /api/payroll/slip) — bukan sekadar pratinjau — supaya begitu
   * dihitung, langsung ada slip sungguhan dengan kehadiran & tempat mengisi
   * penyesuaian manual. Menggantikan `calculateMutation` di bawah untuk kasus
   * ini; karyawan yang cuma melihat gajinya sendiri tetap memakai pratinjau.
   */
  const generateSlipMutation = useMutation({
    mutationFn: async (params: { employeeId: string; month: number; year: number }) => {
      const res = await fetch("/api/payroll/slip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? "Gagal menghitung gaji");
      return json.data.slip as PayrollSlipDetailView;
    },
    onSuccess: (slip) => {
      queryClient.setQueryData(savedSlipQueryKey, slip);
      toast.success("Gaji bulan ini berhasil dihitung dan disimpan");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const calculateMutation = useMutation({
    mutationFn: async (params: {
      employeeId: string;
      month: number;
      year: number;
    }) => {
      const res = await fetch("/api/payroll/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Gagal menghitung");
      return data.data as PayrollResult;
    },
    onSuccess: (data) => {
      setResult(data);
      toast.success("Gaji bulan ini berhasil dihitung");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleCalculate = () => {
    if (!userId || !month || !year) {
      toast.error("Pilih karyawan, bulan, dan tahun");
      return;
    }
    const params = { employeeId: userId, month: Number(month), year: Number(year) };
    if (canManageSelected) {
      generateSlipMutation.mutate(params);
    } else {
      setResult(null);
      calculateMutation.mutate(params);
    }
  };

  // Server sudah menyaring `users` ke PT yang boleh dilihat; filter ini murni
  // untuk mempersempit tampilan, bukan gerbang keamanan.
  const visibleUsers = users.filter(
    (u) => u.isActive && (companyId === "all" || u.companyId === companyId)
  );

  const kpiScore = result ? result.kpi.score : 0;
  const grade = getGrade(kpiScore);
  // Bonus/potongan seluruhnya berasal dari rule engine — modul KPI hanya
  // memberi skornya. Matriks insentif lama sudah dibuang (migrasi
  // 20260805020000), jadi tidak ada lagi dua sumber angka untuk hal yang sama.

  // Entri rule yang benar-benar mengubah angka. Yang bernilai 0 atau di-skip
  // tetap ditampilkan, tapi di bagian Reward & Punishment beserta alasannya —
  // bukan di rincian gaji, supaya rincian tetap terbaca sebagai daftar uang.
  const appliedRuleEntries = (result?.rules.entries ?? []).filter(
    (e) => e.status === "APPLIED" && e.amount !== 0
  );

  // Ringkasan konsekuensi KPI, menggantikan outcomeLabel matriks lama. Labelnya
  // diambil dari tier yang benar-benar dipakai, bukan disusun ulang — supaya
  // alasan yang tampil selalu cocok dengan angkanya.
  const ruleOutcomeLabel =
    appliedRuleEntries.length > 0
      ? [...new Set(appliedRuleEntries.map((e) => e.label))].join(" · ")
      : result
        ? "Tanpa bonus maupun potongan"
        : "Belum ada hasil";

  return (
    <div className="flex flex-col gap-6">
      {/* Selection form */}
      <div className="bg-card grid grid-cols-1 gap-4 rounded-xl border p-4 shadow-sm sm:grid-cols-4">
        {companies.length > 1 && (
          <div className="grid gap-1.5">
            <Label>PT</Label>
            <Select
              value={companyId}
              onValueChange={(v) => {
                setCompanyId(v);
                // Karyawan yang sedang dipilih bisa jadi bukan milik PT baru.
                setUserId("");
                setResult(null);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Semua PT" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua PT</SelectItem>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="sm:col-span-2 grid gap-1.5">
          <Label>Karyawan *</Label>
          <Select
            value={userId}
            onValueChange={(v) => {
              setUserId(v);
              setResult(null);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Pilih karyawan" />
            </SelectTrigger>
            <SelectContent>
              {visibleUsers.length === 0 ? (
                <div className="text-muted-foreground px-2 py-3 text-center text-xs">
                  Tidak ada karyawan aktif di PT ini
                </div>
              ) : (
                visibleUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name} — {u.role} ({u.branchName})
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>Bulan *</Label>
          <Select
            value={month}
            onValueChange={(v) => {
              setMonth(v);
              setResult(null);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTH_NAMES.slice(1).map((name, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>Tahun *</Label>
          <Input
            type="number"
            min="2020"
            max="2100"
            value={year}
            onChange={(e) => {
              setYear(e.target.value);
              setResult(null);
            }}
          />
        </div>
        {/* Tombol Hitung cuma relevan kalau belum ada slip tersimpan untuk
            periode ini — kalau sudah, dia langsung tampil di bawah tanpa
            perlu ditekan. */}
        {!hasSavedSlip && !(userId && savedSlipQuery.isLoading) && (
          <div className="sm:col-span-4">
            <Button
              onClick={handleCalculate}
              disabled={!userId || calculateMutation.isPending || generateSlipMutation.isPending}
            >
              {calculateMutation.isPending || generateSlipMutation.isPending
                ? "Menghitung..."
                : canManageSelected
                  ? "Hitung & Simpan Gaji"
                  : "Hitung Gaji & KPI"}
            </Button>
          </div>
        )}
      </div>

      {/* Memeriksa apakah periode ini sudah pernah dihitung & tersimpan */}
      {userId && (savedSlipQuery.isLoading || generateSlipMutation.isPending) && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
      )}

      {/* Sudah pernah dihitung — tampilkan slip tersimpan apa adanya, termasuk
          penyesuaian manual. "Hitung ulang" ada di dalamnya sendiri (kalau
          berwenang), bukan lewat kalkulator ad hoc di atas. */}
      {hasSavedSlip && savedSlipQuery.data && selectedUser && (
        <div className="space-y-3">
          <p className="text-muted-foreground text-sm text-pretty">
            Gaji {selectedUser.name} periode {MONTH_NAMES[Number(month)]} {year} sudah pernah
            dihitung dan tersimpan — ini hasilnya.
          </p>
          <PayrollSlipDetailClient slip={savedSlipQuery.data} canManage={canManageSelected} />
        </div>
      )}

      {/* Loading skeleton */}
      {!hasSavedSlip && calculateMutation.isPending && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-48 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-lg" />
        </div>
      )}

      {!hasSavedSlip && result && selectedUser && !calculateMutation.isPending && (
        <>
          {/* Sorotan hasil perhitungan — blok data editorial, bukan kartu */}
          <section className="border-border border-y py-8">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))] lg:gap-0 lg:[&>*:not(:first-child)]:border-l lg:[&>*:not(:first-child)]:pl-8 lg:[&>*:not(:last-child)]:pr-8">
              <MetricBlock
                label="Total Gaji Bulan Ini"
                size="hero"
                prefix="Rp"
                value={formatAmount(result.final.takeHomePay)}
                meta={
                  <>
                    {result.employee.name} · {selectedUser.role} ·{" "}
                    {selectedUser.branchName} — {MONTH_NAMES[result.period.month]}{" "}
                    {result.period.year}
                  </>
                }
              />
              <MetricBlock
                label="Skor KPI"
                size="secondary"
                value={(kpiScore * 100).toFixed(1).replace(".", ",")}
                suffix="%"
                meta={grade.label}
              />
              <MetricBlock
                label="Nilai"
                size="secondary"
                tone={grade.tone}
                value={grade.letter}
                meta={ruleOutcomeLabel}
              />
              <MetricBlock
                label="Hari Tercatat"
                size="secondary"
                value={result.attendanceDetail.totalDaysLogged}
                suffix="hari"
                meta={`Dihitung ${new Date(result.kpi.calculatedAt).toLocaleString("id-ID")}`}
              />
            </div>
          </section>

          {/* Warning: no salary set */}
          {result.components.baseSalary === 0 && (
            <Alert variant="destructive">
              <IconAlertCircle className="size-4" />
              <AlertDescription>
                Gaji pokok belum diisi untuk karyawan ini. Atur di halaman{" "}
                <strong>Pengguna</strong>.
              </AlertDescription>
            </Alert>
          )}

          {/* Sanksi non-uang yang menyertai tier */}
          {result.rules.mandatorySaturday && (
            <Alert>
              <IconInfoCircle className="size-4" />
              <AlertDescription>
                Karyawan wajib masuk kerja hari Sabtu sebagai konsekuensi KPI bulan ini.
              </AlertDescription>
            </Alert>
          )}

          {result.rules.warningLetter && (
            <Alert variant="destructive">
              <IconAlertCircle className="size-4" />
              <AlertDescription>
                Skor KPI bulan ini disertai Surat Peringatan.
              </AlertDescription>
            </Alert>
          )}

          {/* Reward & punishment dari rule engine (config/payroll-rules/) */}
          <RewardPunishmentSection rules={result.rules} />

          {/* Salary breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Rincian Gaji — {MONTH_NAMES[result.period.month]}{" "}
                {result.period.year}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Fixed income */}
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Gaji Pokok</span>
                <span className="tabular font-medium">
                  {formatCurrency(result.components.baseSalary)}
                </span>
              </div>

              {result.components.mealAllowance > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Uang Makan</span>
                  <span className="tabular">
                    {formatCurrency(result.components.mealAllowance)}
                  </span>
                </div>
              )}

              {result.components.transportAllowance > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Uang Transport</span>
                  <span className="tabular">
                    {formatCurrency(result.components.transportAllowance)}
                  </span>
                </div>
              )}

              {result.components.positionAllowance > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Uang Jabatan</span>
                  <span className="tabular">
                    {formatCurrency(result.components.positionAllowance)}
                  </span>
                </div>
              )}

              {result.components.bpjsKesehatan > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">BPJS Kesehatan</span>
                  <span className="tabular">
                    {formatCurrency(result.components.bpjsKesehatan)}
                  </span>
                </div>
              )}

              {/* Tunjangan tambahan dari komponen gaji custom */}
              {result.components.extraAllowances.map((c) => (
                <div key={c.name} className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">{c.name}</span>
                  <span className="tabular">{formatCurrency(c.amount)}</span>
                </div>
              ))}

              <div className="flex justify-between items-center font-medium pt-1 border-t">
                <span>Gaji Kotor</span>
                <span className="tabular">
                  {formatCurrency(result.components.totalGrossFixed)}
                </span>
              </div>

              {/* Deductions */}
              {result.deductions.total > 0 && (
                <>
                  <Separator />
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                    Potongan
                  </p>
                  {result.deductions.absence > 0 && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">
                        Potongan Absen / Izin
                      </span>
                      <span className="tabular text-destructive">
                        −{formatCurrency(result.deductions.absence)}
                      </span>
                    </div>
                  )}
                  {result.deductions.components.map((c) => (
                    <div key={c.name} className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">{c.name}</span>
                      <span className="tabular text-destructive">
                        −{formatCurrency(c.amount)}
                      </span>
                    </div>
                  ))}
                </>
              )}

              {/* Reward & punishment dari rule engine — satu baris per rule yang
                  benar-benar berdampak. Rincian lengkapnya ada di bagian
                  Reward & Punishment di atas. */}
              {appliedRuleEntries.length > 0 && (
                <>
                  <Separator />
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                    Reward & Punishment
                  </p>
                  {appliedRuleEntries.map((e) => (
                    <div
                      key={`${e.ruleId}@${e.ruleVersion}`}
                      className="flex justify-between items-center text-sm"
                    >
                      <span className="text-muted-foreground">{e.label}</span>
                      <span
                        className={`tabular ${
                          e.amount >= 0 ? "text-success" : "text-destructive"
                        }`}
                      >
                        {e.amount >= 0 ? "+" : "−"}
                        {formatCurrency(Math.abs(e.amount))}
                      </span>
                    </div>
                  ))}
                </>
              )}

              <Separator />

              <div className="flex justify-between items-center font-semibold text-lg pt-1">
                <span>Total Gaji Diterima</span>
                <span className="tabular">
                  {formatCurrency(result.final.takeHomePay)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* KPI detail breakdown */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">
              Detail KPI
            </h3>
            <div className="bg-card overflow-hidden rounded-xl border shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>KPI</TableHead>
                    <TableHead>Cara Penilaian</TableHead>
                    <TableHead className="text-right">Bobot</TableHead>
                    <TableHead>Perhitungan</TableHead>
                    <TableHead className="text-right">Pencapaian</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(result.kpi.breakdownJson.items ?? []).map((item) => (
                    <TableRow key={item.roleKpiId}>
                      <TableCell className="font-medium">
                        {item.kpiName}
                        {item.noData && (
                          <span className="text-muted-foreground ml-1 text-[11px] font-normal">
                            · belum ada data
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={scoringTone(item.scoringType)}>
                          {SCORING_TYPE_LABELS[item.scoringType] ?? item.scoringType}
                        </Badge>
                      </TableCell>
                      <TableCell className="tabular text-right">
                        {(item.weight * 100).toFixed(0)}%
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {item.explanation}
                      </TableCell>
                      <TableCell className="text-right tabular font-medium">
                        {formatPercent(item.achievement)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
