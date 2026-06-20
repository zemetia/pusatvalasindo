"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { KPI_TYPE_LABELS } from "../kpi-definition-sheet";

export type UserRow = {
  id: string;
  name: string;
  role: string;
  branchName: string;
  isActive: boolean;
};

const MONTH_NAMES = [
  "",
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function getGrade(score: number) {
  if (score >= 0.9) return { letter: "A", label: "Sangat Baik", className: "text-green-600" };
  if (score >= 0.75) return { letter: "B", label: "Baik", className: "text-blue-600" };
  if (score >= 0.6) return { letter: "C", label: "Cukup", className: "text-yellow-600" };
  return { letter: "D", label: "Kurang", className: "text-red-600" };
}

type BreakdownItem = {
  kpiId: string;
  kpiName: string;
  type: string;
  maxScore: string;
  threshold?: string;
  totalPenalty?: string;
  targetValue?: string;
  actual?: string;
  achievement?: string;
  score: string;
};

type MonthlyResult = {
  id: string;
  month: number;
  year: number;
  totalScore: string;
  breakdownJson: { items: BreakdownItem[] };
  calculatedAt: string;
};

export function CalculatePageClient({ users }: { users: UserRow[] }) {
  const now = new Date();
  const [userId, setUserId] = useState("");
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [result, setResult] = useState<MonthlyResult | null>(null);
  const [calculating, setCalculating] = useState(false);

  const handleCalculate = async () => {
    if (!userId || !month || !year) {
      toast.error("Pilih karyawan, bulan, dan tahun");
      return;
    }
    setCalculating(true);
    try {
      const res = await fetch("/api/kpi-monthly-results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: userId,
          month: Number(month),
          year: Number(year),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Gagal menghitung");
        return;
      }
      setResult(data.data);
      toast.success("KPI bulan ini berhasil dihitung");
    } finally {
      setCalculating(false);
    }
  };

  const totalScore = result ? Number(result.totalScore) : 0;
  const grade = getGrade(totalScore);

  return (
    <div className="flex flex-col gap-6">
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
          <Button onClick={handleCalculate} disabled={!userId || calculating}>
            {calculating ? "Menghitung..." : "Hitung KPI Bulanan"}
          </Button>
        </div>
      </div>

      {result && (
        <>
          <div className="flex flex-wrap gap-6 p-4 border rounded-lg bg-muted/30">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Periode</p>
              <p className="font-medium">
                {MONTH_NAMES[result.month]} {result.year}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Total Skor</p>
              <p className="text-2xl font-mono font-semibold">
                {(totalScore * 100).toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Nilai</p>
              <p className={`text-2xl font-bold ${grade.className}`}>
                {grade.letter}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Keterangan</p>
              <p className="font-medium">{grade.label}</p>
            </div>
            <div className="ml-auto self-end text-xs text-muted-foreground">
              Dihitung: {new Date(result.calculatedAt).toLocaleString("id-ID")}
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>KPI</TableHead>
                  <TableHead>Tipe</TableHead>
                  <TableHead className="text-right">Max Score</TableHead>
                  <TableHead className="text-right">Detail</TableHead>
                  <TableHead className="text-right">Skor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(result.breakdownJson.items ?? []).map((item) => (
                  <TableRow key={item.kpiId}>
                    <TableCell className="font-medium">{item.kpiName}</TableCell>
                    <TableCell>
                      <Badge
                        variant={item.type === "EVENT" ? "destructive" : "default"}
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
                        : `${(Number(item.achievement ?? 0) * 100).toFixed(1)}% dari target`}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      {(Number(item.score) * 100).toFixed(2)}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
