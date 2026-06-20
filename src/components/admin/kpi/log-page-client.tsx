"use client";

import { useState, useMemo } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { IconTrash, IconAlertCircle } from "@tabler/icons-react";
import { RoleKpiDetailRow as RoleKpiRow } from "./role-kpi-detail-sheet";
import { MONTH_NAMES, getGrade, type MonthlyResult } from "@/lib/kpi-utils";

export type UserRow = {
  id: string;
  name: string;
  role: string;
  customRoleId: string;
  branchName: string;
  isActive: boolean;
};

type LogEntry = {
  id: string;
  kpiId: string;
  value: string;
  note: string | null;
  createdAt: string;
  definition: { name: string; type: string };
};

type TargetEntry = {
  id: string;
  amount: string;
  date: string;
  note: string | null;
};

// ── Query & mutation helpers ─────────────────────────────────────────────────

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Request gagal");
  return data.data as T;
}

async function mutateJson<T>(
  url: string,
  method: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Gagal");
  return data.data as T;
}

// ── Skeleton rows ────────────────────────────────────────────────────────────

function TableSkeletonRows({ cols, rows = 3 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: cols }).map((_, j) => (
            <TableCell key={j}>
              <Skeleton className="h-4 w-full" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function LogPageClient({
  users,
  roleKpis,
}: {
  users: UserRow[];
  roleKpis: RoleKpiRow[];
}) {
  const now = new Date();
  const queryClient = useQueryClient();

  const [userId, setUserId] = useState("");
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));

  const [newKpiId, setNewKpiId] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newNote, setNewNote] = useState("");

  const [newAmount, setNewAmount] = useState("");
  const [newTargetNote, setNewTargetNote] = useState("");

  const selectedUser = users.find((u) => u.id === userId);

  const eventKpisForRole = useMemo(() => {
    if (!selectedUser) return [];
    return roleKpis.filter(
      (rk) =>
        rk.customRoleId === selectedUser.customRoleId &&
        rk.definition.type === "EVENT"
    );
  }, [selectedUser, roleKpis]);

  // ── Queries ────────────────────────────────────────────────────────────────

  const logsKey = ["kpi-logs", userId, month, year] as const;
  const targetsKey = ["revenues", userId, month, year] as const;
  const kpiResultKey = ["kpi-monthly-results", userId, month, year] as const;

  const { data: logs = [], isLoading: logsLoading } = useQuery({
    queryKey: logsKey,
    queryFn: () =>
      fetchJson<LogEntry[]>(
        `/api/kpi-logs?employeeId=${userId}&month=${month}&year=${year}`
      ),
    enabled: !!userId,
  });

  const { data: targets = [], isLoading: targetsLoading } = useQuery({
    queryKey: targetsKey,
    queryFn: () =>
      fetchJson<TargetEntry[]>(
        `/api/revenues?employeeId=${userId}&month=${month}&year=${year}`
      ),
    enabled: !!userId,
  });

  const { data: kpiResult = null } = useQuery({
    queryKey: kpiResultKey,
    queryFn: () =>
      fetchJson<MonthlyResult | null>(
        `/api/kpi-monthly-results?employeeId=${userId}&month=${month}&year=${year}`
      ),
    enabled: !!userId,
  });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const addLogMutation = useMutation({
    mutationFn: (body: { kpiId: string; value: number; note?: string }) =>
      mutateJson("/api/kpi-logs", "POST", { employeeId: userId, ...body }),
    onSuccess: () => {
      toast.success("Log pelanggaran dicatat");
      setNewKpiId("");
      setNewValue("");
      setNewNote("");
      queryClient.invalidateQueries({ queryKey: logsKey });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteLogMutation = useMutation({
    mutationFn: (id: string) => mutateJson(`/api/kpi-logs/${id}`, "DELETE"),
    onSuccess: () => {
      toast.success("Log dihapus");
      queryClient.invalidateQueries({ queryKey: logsKey });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const addTargetMutation = useMutation({
    mutationFn: (body: { amount: number; note?: string }) =>
      mutateJson("/api/revenues", "POST", { employeeId: userId, ...body }),
    onSuccess: () => {
      toast.success("Target / omset dicatat");
      setNewAmount("");
      setNewTargetNote("");
      queryClient.invalidateQueries({ queryKey: targetsKey });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteTargetMutation = useMutation({
    mutationFn: (id: string) => mutateJson(`/api/revenues/${id}`, "DELETE"),
    onSuccess: () => {
      toast.success("Entri dihapus");
      queryClient.invalidateQueries({ queryKey: targetsKey });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleAddLog = () => {
    if (!newKpiId || !newValue) {
      toast.error("Pilih KPI dan isi nilai pelanggaran");
      return;
    }
    addLogMutation.mutate({
      kpiId: newKpiId,
      value: Number(newValue),
      note: newNote || undefined,
    });
  };

  const handleDeleteLog = (id: string) => {
    if (!confirm("Hapus log ini?")) return;
    deleteLogMutation.mutate(id);
  };

  const handleAddTarget = () => {
    if (!newAmount) {
      toast.error("Isi jumlah omset/target");
      return;
    }
    addTargetMutation.mutate({
      amount: Number(newAmount),
      note: newTargetNote || undefined,
    });
  };

  const handleDeleteTarget = (id: string) => {
    if (!confirm("Hapus entri ini?")) return;
    deleteTargetMutation.mutate(id);
  };

  const totalTarget = targets.reduce((s, r) => s + Number(r.amount), 0);
  const isLoading = logsLoading || targetsLoading;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">
      {/* Selector karyawan + periode */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 border rounded-lg">
        <div className="col-span-2 grid gap-1.5">
          <Label>Karyawan *</Label>
          <Select value={userId} onValueChange={setUserId}>
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
          <Label>Bulan</Label>
          <Select value={month} onValueChange={setMonth}>
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
          <Label>Tahun</Label>
          <Input
            type="number"
            min="2020"
            max="2100"
            value={year}
            onChange={(e) => setYear(e.target.value)}
          />
        </div>
      </div>

      {/* Info karyawan terpilih */}
      {userId && selectedUser && (
        <div className="flex items-center gap-3 px-4 py-3 border rounded-lg bg-muted/40">
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{selectedUser.name}</p>
            <p className="text-sm text-muted-foreground">
              {selectedUser.role} &mdash; {selectedUser.branchName}
              <span className="ml-2 text-xs">
                · {MONTH_NAMES[Number(month)]} {year}
              </span>
            </p>
          </div>
          {isLoading && (
            <span className="text-xs text-muted-foreground animate-pulse">
              Memuat...
            </span>
          )}
        </div>
      )}

      {/* Mini KPI score preview */}
      {userId && !isLoading && kpiResult && (
        <div className="flex items-center justify-between gap-4 px-4 py-3 border rounded-lg bg-muted/20">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-xs text-muted-foreground">Skor KPI</p>
              <p className="text-xl font-mono font-semibold">
                {(Number(kpiResult.totalScore) * 100).toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Nilai</p>
              <p className={`text-xl font-bold ${getGrade(Number(kpiResult.totalScore)).className}`}>
                {getGrade(Number(kpiResult.totalScore)).letter}
                <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                  {getGrade(Number(kpiResult.totalScore)).label}
                </span>
              </p>
            </div>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard/payroll">Hitung Gaji →</Link>
          </Button>
        </div>
      )}

      {/* Nudge: ada log tapi KPI belum dihitung */}
      {userId && !isLoading && !kpiResult && logs.length + targets.length > 0 && (
        <Alert>
          <IconAlertCircle className="size-4" />
          <AlertDescription>
            <div className="flex items-center justify-between gap-4">
              <span>KPI belum dihitung untuk periode ini.</span>
              <Button asChild size="sm" variant="outline">
                <Link href="/dashboard/payroll">Hitung KPI & Gaji →</Link>
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Tab content */}
      {userId && (
        <Tabs defaultValue="events" className="flex flex-col gap-4">
          <TabsList className="w-fit">
            <TabsTrigger value="events">
              Log Pelanggaran ({logs.length})
            </TabsTrigger>
            <TabsTrigger value="target">
              Target / Omset ({targets.length})
            </TabsTrigger>
          </TabsList>

          {/* ── Tab: Log Pelanggaran ───────────────────────────── */}
          <TabsContent value="events" className="mt-0 flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-4 border rounded-lg bg-muted/30">
              <div className="sm:col-span-2 grid gap-1.5">
                <Label>KPI Pelanggaran</Label>
                <Select value={newKpiId} onValueChange={setNewKpiId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih KPI event" />
                  </SelectTrigger>
                  <SelectContent>
                    {eventKpisForRole.length === 0 ? (
                      <SelectItem value="__none__" disabled>
                        Tidak ada KPI event untuk jabatan ini
                      </SelectItem>
                    ) : (
                      eventKpisForRole.map((rk) => (
                        <SelectItem key={rk.kpiId} value={rk.kpiId}>
                          {rk.definition.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Nilai Poin</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="Contoh: 4"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Catatan</Label>
                <Input
                  placeholder="Opsional"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                />
              </div>
              <div className="sm:col-span-4">
                <Button
                  onClick={handleAddLog}
                  disabled={addLogMutation.isPending}
                >
                  {addLogMutation.isPending ? "Menyimpan..." : "+ Catat Pelanggaran"}
                </Button>
              </div>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>KPI</TableHead>
                    <TableHead className="text-right">Nilai Poin</TableHead>
                    <TableHead>Catatan</TableHead>
                    <TableHead>Waktu</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logsLoading ? (
                    <TableSkeletonRows cols={5} />
                  ) : logs.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center text-muted-foreground py-6"
                      >
                        Tidak ada log pelanggaran untuk periode ini.
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="font-medium">
                          {l.definition.name}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {Number(l.value)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {l.note ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(l.createdAt).toLocaleString("id-ID")}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            disabled={deleteLogMutation.isPending}
                            onClick={() => handleDeleteLog(l.id)}
                          >
                            <IconTrash className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* ── Tab: Target / Omset ───────────────────────────── */}
          <TabsContent value="target" className="mt-0 flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 border rounded-lg bg-muted/30">
              <div className="grid gap-1.5">
                <Label>Jumlah (IDR)</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="Contoh: 5000000"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Catatan</Label>
                <Input
                  placeholder="Opsional"
                  value={newTargetNote}
                  onChange={(e) => setNewTargetNote(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button
                  onClick={handleAddTarget}
                  disabled={addTargetMutation.isPending}
                >
                  {addTargetMutation.isPending
                    ? "Menyimpan..."
                    : "+ Catat Target / Omset"}
                </Button>
              </div>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead className="text-right">Jumlah</TableHead>
                    <TableHead>Catatan</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {targetsLoading ? (
                    <TableSkeletonRows cols={4} />
                  ) : targets.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center text-muted-foreground py-6"
                      >
                        Tidak ada entri target / omset untuk periode ini.
                      </TableCell>
                    </TableRow>
                  ) : (
                    targets.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(r.date).toLocaleDateString("id-ID")}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          Rp {Number(r.amount).toLocaleString("id-ID")}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {r.note ?? "—"}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            disabled={deleteTargetMutation.isPending}
                            onClick={() => handleDeleteTarget(r.id)}
                          >
                            <IconTrash className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {targets.length > 0 && (
              <div className="text-sm text-muted-foreground text-right">
                Total:{" "}
                <span className="font-mono font-medium text-foreground">
                  Rp {totalTarget.toLocaleString("id-ID")}
                </span>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
