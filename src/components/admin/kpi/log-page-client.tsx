"use client";

import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { IconTrash } from "@tabler/icons-react";
import { RoleKpiDetailRow as RoleKpiRow } from "./role-kpi-detail-sheet";

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

export function LogPageClient({
  users,
  roleKpis,
}: {
  users: UserRow[];
  roleKpis: RoleKpiRow[];
}) {
  const [userId, setUserId] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [targets, setTargets] = useState<TargetEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const [newKpiId, setNewKpiId] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newNote, setNewNote] = useState("");
  const [savingLog, setSavingLog] = useState(false);

  const [newAmount, setNewAmount] = useState("");
  const [newTargetNote, setNewTargetNote] = useState("");
  const [savingTarget, setSavingTarget] = useState(false);

  const selectedUser = users.find((u) => u.id === userId);

  const eventKpisForRole = useMemo(() => {
    if (!selectedUser) return [];
    return roleKpis.filter(
      (rk) => rk.customRoleId === selectedUser.customRoleId && rk.definition.type === "EVENT"
    );
  }, [selectedUser, roleKpis]);

  const loadData = async (uid: string) => {
    setLoading(true);
    try {
      const [logsRes, targetsRes] = await Promise.all([
        fetch(`/api/kpi-logs?employeeId=${uid}`),
        fetch(`/api/revenues?employeeId=${uid}`),
      ]);
      const [logsData, targetsData] = await Promise.all([
        logsRes.json(),
        targetsRes.json(),
      ]);
      setLogs(logsData.data ?? []);
      setTargets(targetsData.data ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!userId) {
      setLogs([]);
      setTargets([]);
      return;
    }
    loadData(userId);
  }, [userId]);

  const handleAddLog = async () => {
    if (!newKpiId || !newValue) {
      toast.error("Pilih KPI dan isi nilai pelanggaran");
      return;
    }
    setSavingLog(true);
    try {
      const res = await fetch("/api/kpi-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: userId,
          kpiId: newKpiId,
          value: Number(newValue),
          note: newNote || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Gagal menyimpan");
        return;
      }
      toast.success("Log pelanggaran dicatat");
      setNewKpiId("");
      setNewValue("");
      setNewNote("");
      await loadData(userId);
    } finally {
      setSavingLog(false);
    }
  };

  const handleDeleteLog = async (id: string) => {
    if (!confirm("Hapus log ini?")) return;
    const res = await fetch(`/api/kpi-logs/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Gagal menghapus");
      return;
    }
    toast.success("Log dihapus");
    setLogs((prev) => prev.filter((l) => l.id !== id));
  };

  const handleAddTarget = async () => {
    if (!newAmount) {
      toast.error("Isi jumlah omset/target");
      return;
    }
    setSavingTarget(true);
    try {
      const res = await fetch("/api/revenues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: userId,
          amount: Number(newAmount),
          note: newTargetNote || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Gagal menyimpan");
        return;
      }
      toast.success("Target / omset dicatat");
      setNewAmount("");
      setNewTargetNote("");
      await loadData(userId);
    } finally {
      setSavingTarget(false);
    }
  };

  const handleDeleteTarget = async (id: string) => {
    if (!confirm("Hapus entri ini?")) return;
    const res = await fetch(`/api/revenues/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Gagal menghapus");
      return;
    }
    toast.success("Entri dihapus");
    setTargets((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Selector karyawan */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 border rounded-lg">
        <div className="grid gap-1.5">
          <Label>Karyawan *</Label>
          <Select
            value={userId}
            onValueChange={(v) => setUserId(v)}
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
        {loading && (
          <div className="flex items-end">
            <span className="text-sm text-muted-foreground">Memuat data...</span>
          </div>
        )}
      </div>

      {userId && !loading && selectedUser && (
        <div className="flex items-center gap-3 px-4 py-3 border rounded-lg bg-muted/40">
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{selectedUser.name}</p>
            <p className="text-sm text-muted-foreground">
              {selectedUser.role} &mdash; {selectedUser.branchName}
            </p>
          </div>
        </div>
      )}

      {userId && !loading && (
        <Tabs defaultValue="events" className="flex flex-col gap-4">
          <TabsList className="w-fit">
            <TabsTrigger value="events">
              Log Pelanggaran ({logs.length})
            </TabsTrigger>
            <TabsTrigger value="target">
              Target / Omset ({targets.length})
            </TabsTrigger>
          </TabsList>

          {/* Log Pelanggaran */}
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
                <Button onClick={handleAddLog} disabled={savingLog}>
                  {savingLog ? "Menyimpan..." : "+ Catat Pelanggaran"}
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
                  {logs.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center text-muted-foreground py-6"
                      >
                        Belum ada log pelanggaran.
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
                        <TableCell className="text-muted-foreground text-sm">
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

          {/* Target / Omset */}
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
                <Button onClick={handleAddTarget} disabled={savingTarget}>
                  {savingTarget ? "Menyimpan..." : "+ Catat Target / Omset"}
                </Button>
              </div>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Waktu</TableHead>
                    <TableHead className="text-right">Jumlah</TableHead>
                    <TableHead>Catatan</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {targets.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center text-muted-foreground py-6"
                      >
                        Belum ada entri target / omset.
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
                        <TableCell className="text-muted-foreground text-sm">
                          {r.note ?? "—"}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
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
                  Rp{" "}
                  {targets
                    .reduce((s, r) => s + Number(r.amount), 0)
                    .toLocaleString("id-ID")}
                </span>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
