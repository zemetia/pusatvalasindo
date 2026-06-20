"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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

  const [newKpiId, setNewKpiId] = useState("");
  const [newValue, setNewValue] = useState("1");
  const [newNote, setNewNote] = useState("");

  const eventKpis = roleKpis.filter((k) => k.type === "EVENT");

  const logsKey = ["kpi-logs-self", userId, month, year] as const;

  const { data: logs = [], isLoading } = useQuery({
    queryKey: logsKey,
    queryFn: () =>
      fetchJson<LogEntry[]>(
        `/api/kpi-logs?employeeId=${userId}&month=${month}&year=${year}`
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

  const handleAdd = () => {
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

  const handleDelete = (id: string) => {
    if (!confirm("Hapus catatan ini?")) return;
    deleteLogMutation.mutate(id);
  };

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

      {/* Form isi KPI */}
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
            onClick={handleAdd}
            disabled={addLogMutation.isPending}
            className="w-fit"
          >
            {addLogMutation.isPending ? "Menyimpan..." : "+ Catat"}
          </Button>
        </div>
      ) : (
        <div className="px-4 py-3 border rounded-lg text-sm text-muted-foreground">
          Tidak ada KPI yang dapat diisi untuk jabatan ini.
        </div>
      )}

      {/* Riwayat log */}
      <div className="flex flex-col gap-2">
        <h3 className="font-medium text-sm">
          Riwayat — {MONTH_NAMES[Number(month)]} {year}
        </h3>
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
              {isLoading ? (
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
                        onClick={() => handleDelete(l.id)}
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
      </div>
    </div>
  );
}
