"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { IconTrash } from "@tabler/icons-react";
import { MONTH_NAMES } from "@/lib/kpi-utils";

type RoleKpiItem = {
  kpiId: string;
  name: string;
  type: string;
};

type LogEntry = {
  id: string;
  kpiId: string;
  value: string;
  note: string | null;
  createdAt: string;
  definition: { name: string; type: string };
};

type RevenueEntry = {
  id: string;
  amount: string;
  date: string;
  note: string | null;
};

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Request gagal");
  return data.data as T;
}

async function mutateJson<T>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Gagal");
  return data.data as T;
}

function TableSkeletonRows({ cols, rows = 3 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: cols }).map((_, j) => (
            <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

export function KpiSelfFillClient({
  userId,
  userName,
  roleName,
  roleKpis,
}: {
  userId: string;
  userName: string;
  roleName: string;
  roleKpis: RoleKpiItem[];
}) {
  const now = new Date();
  const queryClient = useQueryClient();

  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));

  // Event log state
  const [newKpiId, setNewKpiId] = useState("");
  const [newValue, setNewValue] = useState("1");
  const [newNote, setNewNote] = useState("");

  // Revenue state
  const [newAmount, setNewAmount] = useState("");
  const [newRevenueNote, setNewRevenueNote] = useState("");

  const eventKpis = roleKpis.filter((k) => k.type === "EVENT");

  const logsKey = ["kpi-logs-self", userId, month, year] as const;
  const revenuesKey = ["revenues-self", userId, month, year] as const;

  const { data: logs = [], isLoading: logsLoading } = useQuery({
    queryKey: logsKey,
    queryFn: () =>
      fetchJson<LogEntry[]>(
        `/api/kpi-logs?employeeId=${userId}&month=${month}&year=${year}`
      ),
  });

  const { data: revenues = [], isLoading: revenuesLoading } = useQuery({
    queryKey: revenuesKey,
    queryFn: () =>
      fetchJson<RevenueEntry[]>(
        `/api/revenues?employeeId=${userId}&month=${month}&year=${year}`
      ),
  });

  const addLogMutation = useMutation({
    mutationFn: (body: { kpiId: string; value: number; note?: string }) =>
      mutateJson("/api/kpi-logs/self", "POST", body),
    onSuccess: () => {
      toast.success("KPI berhasil dicatat");
      setNewKpiId("");
      setNewValue("1");
      setNewNote("");
      queryClient.invalidateQueries({ queryKey: logsKey });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteLogMutation = useMutation({
    mutationFn: (id: string) => mutateJson(`/api/kpi-logs/self/${id}`, "DELETE"),
    onSuccess: () => {
      toast.success("Log dihapus");
      queryClient.invalidateQueries({ queryKey: logsKey });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const addRevenueMutation = useMutation({
    mutationFn: (body: { amount: number; note?: string }) =>
      mutateJson("/api/revenues/self", "POST", body),
    onSuccess: () => {
      toast.success("Target / omset berhasil dicatat");
      setNewAmount("");
      setNewRevenueNote("");
      queryClient.invalidateQueries({ queryKey: revenuesKey });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteRevenueMutation = useMutation({
    mutationFn: (id: string) => mutateJson(`/api/revenues/self/${id}`, "DELETE"),
    onSuccess: () => {
      toast.success("Entri dihapus");
      queryClient.invalidateQueries({ queryKey: revenuesKey });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleAddLog = () => {
    if (!newKpiId) {
      toast.error("Pilih jenis pelanggaran terlebih dahulu");
      return;
    }
    addLogMutation.mutate({
      kpiId: newKpiId,
      value: Number(newValue) || 1,
      note: newNote.trim() || undefined,
    });
  };

  const handleDeleteLog = (id: string) => {
    if (!confirm("Hapus catatan ini?")) return;
    deleteLogMutation.mutate(id);
  };

  const handleAddRevenue = () => {
    if (!newAmount) {
      toast.error("Isi jumlah omset / target");
      return;
    }
    addRevenueMutation.mutate({
      amount: Number(newAmount),
      note: newRevenueNote.trim() || undefined,
    });
  };

  const handleDeleteRevenue = (id: string) => {
    if (!confirm("Hapus entri ini?")) return;
    deleteRevenueMutation.mutate(id);
  };

  const totalRevenue = revenues.reduce((s, r) => s + Number(r.amount), 0);

  return (
    <div className="flex flex-col gap-6">
      {/* Info user */}
      <div className="flex items-center gap-3 px-4 py-3 border rounded-lg bg-muted/40">
        <div>
          <p className="font-semibold">{userName}</p>
          <p className="text-sm text-muted-foreground">{roleName}</p>
        </div>
      </div>

      {/* Pilih periode */}
      <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg">
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

      {/* Tabs: Pelanggaran + Target/Omset */}
      <Tabs defaultValue="events" className="flex flex-col gap-4">
        <TabsList className="w-fit">
          <TabsTrigger value="events">
            Log Pelanggaran ({logs.length})
          </TabsTrigger>
          <TabsTrigger value="revenue">
            Target / Omset ({revenues.length})
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Log Pelanggaran ─────────────────────────────── */}
        <TabsContent value="events" className="mt-0 flex flex-col gap-4">
          {eventKpis.length > 0 ? (
            <div className="flex flex-col gap-4 p-4 border rounded-lg bg-muted/30">
              <h3 className="font-medium text-sm">Catat Kejadian / Pelanggaran</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Jenis Kejadian *</Label>
                  <Select value={newKpiId} onValueChange={setNewKpiId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih jenis..." />
                    </SelectTrigger>
                    <SelectContent>
                      {eventKpis.map((k) => (
                        <SelectItem key={k.kpiId} value={k.kpiId}>
                          {k.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Jumlah Kejadian</Label>
                  <Input
                    type="number"
                    min="1"
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>Keterangan / Alasan</Label>
                <Textarea
                  placeholder="Contoh: Terlambat 15 menit karena macet di tol Cengkareng..."
                  rows={2}
                  value={newNote}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewNote(e.target.value)}
                />
              </div>
              <Button
                onClick={handleAddLog}
                disabled={addLogMutation.isPending}
                className="w-fit"
              >
                {addLogMutation.isPending ? "Menyimpan..." : "+ Catat"}
              </Button>
            </div>
          ) : (
            <div className="px-4 py-3 border rounded-lg text-sm text-muted-foreground">
              Tidak ada KPI pelanggaran yang dapat diisi untuk jabatan ini.
            </div>
          )}

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kejadian</TableHead>
                  <TableHead className="text-right">Jumlah</TableHead>
                  <TableHead>Keterangan</TableHead>
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
                      Belum ada catatan untuk periode ini.
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

        {/* ── Tab: Target / Omset ──────────────────────────────── */}
        <TabsContent value="revenue" className="mt-0 flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 border rounded-lg bg-muted/30">
            <div className="grid gap-1.5">
              <Label>Jumlah (IDR) *</Label>
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
                value={newRevenueNote}
                onChange={(e) => setNewRevenueNote(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleAddRevenue}
                disabled={addRevenueMutation.isPending}
              >
                {addRevenueMutation.isPending ? "Menyimpan..." : "+ Catat Omset"}
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
                {revenuesLoading ? (
                  <TableSkeletonRows cols={4} />
                ) : revenues.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center text-muted-foreground py-6"
                    >
                      Belum ada entri omset untuk periode ini.
                    </TableCell>
                  </TableRow>
                ) : (
                  revenues.map((r) => (
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
                          disabled={deleteRevenueMutation.isPending}
                          onClick={() => handleDeleteRevenue(r.id)}
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

          {revenues.length > 0 && (
            <div className="text-sm text-muted-foreground text-right">
              Total:{" "}
              <span className="font-mono font-medium text-foreground">
                Rp {totalRevenue.toLocaleString("id-ID")}
              </span>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
