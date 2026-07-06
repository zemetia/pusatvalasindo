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
import { KPI_TYPE_LABELS } from "@/components/admin/kpi-definition-sheet";
import {
  MONTH_NAMES,
  getGrade,
  formatCurrency,
  type PayrollResult,
} from "@/lib/kpi-utils";

export type UserRow = {
  id: string;
  name: string;
  role: string;
  branchName: string;
  baseSalary: number | null;
  mealAllowance: number | null;
  transportAllowance: number | null;
  positionAllowance: number | null;
  bpjsKesehatan: number | null;
  isActive: boolean;
};

const BONUS_RESULT_LABELS: Record<string, string> = {
  BONUS_CASH: "Bonus Tunai",
  TOP_PERFORMER: "Top Performer",
  SAFE_ZONE: "Zona Aman",
  PENALTY_SATURDAY: "Penalty Masuk Sabtu",
  PENALTY_DEDUCTION: "Potongan KPI",
};

export function PayrollPageClient({ users }: { users: UserRow[] }) {
  const now = new Date();
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

  const kpiScore = result ? result.kpi.score : 0;
  const grade = getGrade(kpiScore);
  const resultType = result?.kpi.resultType ?? null;
  const bonusAmount = result?.kpi.bonusAmount ?? 0;
  const bonusKpi = result?.kpi.bonusKpi ?? 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Selection form */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-4 border rounded-lg">
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
              {users
                .filter((u) => u.isActive)
                .map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name} — {u.role} ({u.branchName})
                  </SelectItem>
                ))}
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
          {/* KPI + employee summary */}
          <div className="flex flex-wrap gap-6 p-4 border rounded-lg bg-muted/30">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Karyawan</p>
              <p className="font-medium">{result.employee.name}</p>
              <p className="text-sm text-muted-foreground">
                {selectedUser.role} · {selectedUser.branchName}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Periode</p>
              <p className="font-medium">
                {MONTH_NAMES[result.period.month]} {result.period.year}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Skor KPI</p>
              <p className="text-2xl font-mono font-semibold">
                {(kpiScore * 100).toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Nilai</p>
              <p className={`text-2xl font-bold ${grade.className}`}>
                {grade.letter}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Keterangan KPI</p>
              <p className="font-medium">{grade.label}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Hari Tercatat</p>
              <p className="font-medium">{result.attendanceDetail.totalDaysLogged} hari</p>
            </div>
            <div className="ml-auto self-end text-xs text-muted-foreground">
              Dihitung:{" "}
              {new Date(result.kpi.calculatedAt).toLocaleString("id-ID")}
            </div>
          </div>

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

          {/* PENALTY_SATURDAY notice */}
          {resultType === "PENALTY_SATURDAY" && bonusAmount > 0 && (
            <Alert>
              <IconInfoCircle className="size-4" />
              <AlertDescription>
                Karyawan wajib masuk kerja hari Sabtu sebagai konsekuensi KPI
                bulan ini.
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
                <span className="font-mono font-medium">
                  {formatCurrency(result.components.baseSalary)}
                </span>
              </div>

              {result.components.mealAllowance > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Uang Makan</span>
                  <span className="font-mono">
                    {formatCurrency(result.components.mealAllowance)}
                  </span>
                </div>
              )}

              {result.components.transportAllowance > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Uang Transport</span>
                  <span className="font-mono">
                    {formatCurrency(result.components.transportAllowance)}
                  </span>
                </div>
              )}

              {result.components.positionAllowance > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Uang Jabatan</span>
                  <span className="font-mono">
                    {formatCurrency(result.components.positionAllowance)}
                  </span>
                </div>
              )}

              {result.components.bpjsKesehatan > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">BPJS Kesehatan</span>
                  <span className="font-mono">
                    {formatCurrency(result.components.bpjsKesehatan)}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center font-medium pt-1 border-t">
                <span>Gaji Kotor</span>
                <span className="font-mono">
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
                      <span className="font-mono text-red-600">
                        −{formatCurrency(result.deductions.late)}
                      </span>
                    </div>
                  )}
                  {result.deductions.absence > 0 && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">
                        Potongan Absen / Izin
                      </span>
                      <span className="font-mono text-red-600">
                        −{formatCurrency(result.deductions.absence)}
                      </span>
                    </div>
                  )}
                </>
              )}

              {/* KPI adjustment */}
              {resultType && resultType !== "SAFE_ZONE" && bonusAmount > 0 && (
                <>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">
                        {BONUS_RESULT_LABELS[resultType] ?? resultType}
                      </span>
                      <Badge
                        variant={bonusKpi >= 0 ? "default" : "destructive"}
                        className="text-xs"
                      >
                        {bonusKpi >= 0 ? "Bonus" : "Potongan"}
                      </Badge>
                    </div>
                    <span
                      className={`font-mono font-medium ${
                        bonusKpi >= 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {bonusKpi >= 0 ? "+" : "−"}
                      {formatCurrency(Math.abs(bonusKpi))}
                    </span>
                  </div>
                </>
              )}

              {resultType === "SAFE_ZONE" && (
                <>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">
                      KPI — Zona Aman
                    </span>
                    <span className="font-mono text-muted-foreground">
                      ± Rp 0
                    </span>
                  </div>
                </>
              )}

              <Separator />

              <div className="flex justify-between items-center font-semibold text-lg pt-1">
                <span>Total Gaji Diterima</span>
                <span className="font-mono">
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
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>KPI</TableHead>
                    <TableHead>Tipe</TableHead>
                    <TableHead className="text-right">Bobot</TableHead>
                    <TableHead className="text-right">Pencapaian</TableHead>
                    <TableHead className="text-right">Skor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(result.kpi.breakdownJson.items ?? []).map((item) => (
                    <TableRow key={item.kpiId}>
                      <TableCell className="font-medium">
                        {item.kpiName}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            item.type === "EVENT" ? "destructive" : "default"
                          }
                        >
                          {KPI_TYPE_LABELS[item.type] ?? item.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {(Number(item.maxScore) * 100).toFixed(0)}%
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {item.type === "EVENT"
                          ? `${item.totalPenalty} / ${item.threshold} poin`
                          : `${(Number(item.achievement ?? 0) * 100).toFixed(
                              1
                            )}% dari target`}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {(Number(item.score) * 100).toFixed(2)}%
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
