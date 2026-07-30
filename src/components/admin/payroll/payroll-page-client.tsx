"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
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
    setResult(null);
    calculateMutation.mutate({
      employeeId: userId,
      month: Number(month),
      year: Number(year),
    });
  };

  // Server sudah menyaring `users` ke PT yang boleh dilihat; filter ini murni
  // untuk mempersempit tampilan, bukan gerbang keamanan.
  const visibleUsers = users.filter(
    (u) => u.isActive && (companyId === "all" || u.companyId === companyId)
  );

  const kpiScore = result ? result.kpi.score : 0;
  const grade = getGrade(kpiScore);
  // Bonus/potongan berasal dari matriks insentif payroll — modul KPI hanya
  // memberi skornya (lihat payroll-incentive.service.ts).
  const incentive = result?.incentive ?? null;
  const netIncentive = incentive?.netAmount ?? 0;

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
        <div className="sm:col-span-4">
          <Button
            onClick={handleCalculate}
            disabled={!userId || calculateMutation.isPending}
          >
            {calculateMutation.isPending ? "Menghitung..." : "Hitung Gaji & KPI"}
          </Button>
        </div>
      </div>

      {/* Loading skeleton */}
      {calculateMutation.isPending && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-48 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-lg" />
        </div>
      )}

      {result && selectedUser && !calculateMutation.isPending && (
        <>
          {/* Sorotan hasil perhitungan — blok data editorial, bukan kartu */}
          <section className="border-border border-y py-8">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))] lg:gap-0 lg:[&>*:not(:first-child)]:border-l lg:[&>*:not(:first-child)]:pl-8 lg:[&>*:not(:last-child)]:pr-8">
              <MetricBlock
                label="Total Gaji Diterima"
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
                meta={incentive?.outcomeLabel ?? "Belum ada hasil"}
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
          {incentive?.mandatorySaturday && (
            <Alert>
              <IconInfoCircle className="size-4" />
              <AlertDescription>
                Karyawan wajib masuk kerja hari Sabtu sebagai konsekuensi KPI bulan ini.
              </AlertDescription>
            </Alert>
          )}

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
                  {result.deductions.late > 0 && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">
                        Potongan Terlambat
                      </span>
                      <span className="tabular text-destructive">
                        −{formatCurrency(result.deductions.late)}
                      </span>
                    </div>
                  )}
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

              {/* Insentif KPI — hasil pemetaan skor ke matriks payroll */}
              {incentive && (
                <>
                  <Separator />
                  {incentive.tierAmount !== 0 && (
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{incentive.outcomeLabel}</span>
                        <Badge
                          variant={incentive.tierAmount >= 0 ? "success" : "danger"}
                          className="text-xs"
                        >
                          {incentive.tierAmount >= 0 ? "Bonus" : "Potongan"}
                        </Badge>
                      </div>
                      <span
                        className={`tabular font-medium ${
                          incentive.tierAmount >= 0 ? "text-success" : "text-destructive"
                        }`}
                      >
                        {incentive.tierAmount >= 0 ? "+" : "−"}
                        {formatCurrency(Math.abs(incentive.tierAmount))}
                      </span>
                    </div>
                  )}

                  {incentive.topPerformerBonus > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">
                        Bonus Top Performer
                        {incentive.rank && (
                          <span className="ml-1 text-xs">
                            (peringkat {incentive.rank} dari {incentive.peerCount})
                          </span>
                        )}
                      </span>
                      <span className="tabular text-success font-medium">
                        +{formatCurrency(incentive.topPerformerBonus)}
                      </span>
                    </div>
                  )}

                  {netIncentive === 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">KPI — {incentive.outcomeLabel}</span>
                      <span className="tabular text-muted-foreground">± Rp 0</span>
                    </div>
                  )}

                  <p className="text-muted-foreground text-xs">{incentive.reason}</p>
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
