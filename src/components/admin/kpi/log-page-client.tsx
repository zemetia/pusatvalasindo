"use client";

import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import {
  IconTrash,
  IconAlertCircle,
  IconCheck,
  IconX,
  IconLock,
  IconLockOpen,
  IconRefresh,
  IconDownload,
} from "@tabler/icons-react";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { MetricBlock } from "@/components/admin/page-shell";
import {
  MONTH_NAMES,
  SCORING_TYPE_LABELS,
  INPUT_SOURCE_LABELS,
  getGrade,
  formatPercent,
  type KpiBreakdown,
} from "@/lib/kpi-utils";

export type UserRow = {
  id: string;
  name: string;
  role: string;
  customRoleId: string;
  branchName: string;
  isActive: boolean;
};

type RoleKpiForEmployee = {
  id: string;
  weight: string;
  targetValue: string | null;
  pointPerUnit: string | null;
  toleranceLimit: string | null;
  definition: {
    id: string;
    name: string;
    description: string | null;
    scoringType: string;
    unit: string;
  };
  policy: { inputSource: string; requiresApproval: boolean; requiresEvidence: boolean };
};

type EntryRow = {
  id: string;
  employeeId: string;
  occurredAt: string;
  weekOfMonth: number;
  quantity: string;
  note: string | null;
  evidenceUrl: string | null;
  source: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewNote: string | null;
  createdBy: { name: string } | null;
  reviewedBy: { name: string } | null;
  employee: { id: string; name: string };
  roleKpi: { definition: { name: string; scoringType: string; unit: string } };
};

type PeriodRow = { status: "OPEN" | "LOCKED"; lockedBy: { name: string } | null } | null;

type MonthlyResultRow = {
  totalScore: string;
  grade: string;
  breakdownJson: KpiBreakdown;
  calculatedAt: string;
} | null;

/** Bentuk balasan /api/kpi-entries/collect — berbeda untuk satu vs semua karyawan. */
type CollectResponse = { locked?: boolean } | { employeeCount: number; totalEntries: number };

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
            <TableCell key={j}>
              <Skeleton className="h-4 w-full" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

const STATUS_META = {
  PENDING: { label: "Menunggu", variant: "warning" },
  APPROVED: { label: "Disetujui", variant: "success" },
  REJECTED: { label: "Ditolak", variant: "destructive" },
} as const satisfies Record<EntryRow["status"], { label: string; variant: BadgeVariant }>;

export function LogPageClient({ users }: { users: UserRow[] }) {
  const now = new Date();
  const queryClient = useQueryClient();

  const [userId, setUserId] = useState("");
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));

  const [roleKpiId, setRoleKpiId] = useState("");
  const [occurredAt, setOccurredAt] = useState(now.toISOString().slice(0, 10));
  const [quantity, setQuantity] = useState("1");
  const [note, setNote] = useState("");

  const selectedUser = users.find((u) => u.id === userId);

  const entriesKey = ["kpi-entries", userId, month, year] as const;
  const resultKey = ["kpi-result", userId, month, year] as const;
  const pendingKey = ["kpi-pending"] as const;

  const { data: roleKpiData } = useQuery({
    queryKey: ["role-kpis-for", userId],
    queryFn: () =>
      fetchJson<{ roleKpis: RoleKpiForEmployee[] }>(
        `/api/role-kpis/for-employee?employeeId=${userId}`
      ),
    enabled: !!userId,
  });

  const { data: entryData, isLoading: entriesLoading } = useQuery({
    queryKey: entriesKey,
    queryFn: () =>
      fetchJson<{ entries: EntryRow[]; period: PeriodRow }>(
        `/api/kpi-entries?employeeId=${userId}&month=${month}&year=${year}`
      ),
    enabled: !!userId,
  });

  const { data: result } = useQuery({
    queryKey: resultKey,
    queryFn: () =>
      fetchJson<MonthlyResultRow>(
        `/api/kpi-monthly-results?employeeId=${userId}&month=${month}&year=${year}`
      ),
    enabled: !!userId,
  });

  const { data: pending = [], isLoading: pendingLoading } = useQuery({
    queryKey: pendingKey,
    queryFn: () => fetchJson<EntryRow[]>("/api/kpi-entries/pending"),
  });

  const roleKpis = useMemo(() => roleKpiData?.roleKpis ?? [], [roleKpiData]);
  // KPI bersumber SYSTEM tidak bisa dicatat manual oleh siapa pun.
  const recordable = roleKpis.filter((rk) => rk.policy.inputSource !== "SYSTEM");
  const entries = entryData?.entries ?? [];
  const period = entryData?.period ?? null;
  const isLocked = period?.status === "LOCKED";

  const selectedKpi = recordable.find((rk) => rk.id === roleKpiId);

  // Jabatan berbeda punya KPI berbeda — pilihan lama tidak boleh ikut terbawa.
  useEffect(() => setRoleKpiId(""), [userId]);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: entriesKey });
    queryClient.invalidateQueries({ queryKey: resultKey });
    queryClient.invalidateQueries({ queryKey: pendingKey });
  };

  const addMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => mutateJson("/api/kpi-entries", "POST", body),
    onSuccess: () => {
      toast.success("KPI berhasil dicatat");
      setQuantity("1");
      setNote("");
      invalidateAll();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, decision, reviewNote }: { id: string; decision: string; reviewNote?: string }) =>
      mutateJson(`/api/kpi-entries/${id}/review`, "POST", { decision, reviewNote }),
    onSuccess: (_d, vars) => {
      toast.success(vars.decision === "APPROVED" ? "Entri disetujui" : "Entri ditolak");
      invalidateAll();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => mutateJson(`/api/kpi-entries/${id}`, "DELETE"),
    onSuccess: () => {
      toast.success("Entri dihapus");
      invalidateAll();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const recalcMutation = useMutation({
    mutationFn: () =>
      mutateJson("/api/kpi-monthly-results", "POST", {
        employeeId: userId,
        month: Number(month),
        year: Number(year),
      }),
    onSuccess: () => {
      toast.success("Skor KPI dihitung ulang");
      queryClient.invalidateQueries({ queryKey: resultKey });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const collectMutation = useMutation({
    mutationFn: (scope: "employee" | "all") =>
      mutateJson<CollectResponse>("/api/kpi-entries/collect", "POST", {
        ...(scope === "employee" ? { employeeId: userId } : {}),
        month: Number(month),
        year: Number(year),
      }),
    onSuccess: (_data, scope) => {
      toast.success(
        scope === "employee"
          ? "Data absensi berhasil ditarik"
          : "Data absensi seluruh karyawan berhasil ditarik"
      );
      invalidateAll();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const periodMutation = useMutation({
    mutationFn: (action: "LOCK" | "UNLOCK") =>
      mutateJson("/api/kpi-periods", "POST", {
        employeeId: userId,
        month: Number(month),
        year: Number(year),
        action,
      }),
    onSuccess: (_d, action) => {
      toast.success(action === "LOCK" ? "Periode dikunci" : "Periode dibuka kembali");
      invalidateAll();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleAdd = () => {
    if (!userId) return toast.error("Pilih karyawan terlebih dahulu");
    if (!roleKpiId) return toast.error("Pilih KPI terlebih dahulu");
    const qty = Number(quantity);
    if (!Number.isFinite(qty)) return toast.error("Jumlah harus berupa angka");

    addMutation.mutate({
      employeeId: userId,
      roleKpiId,
      occurredAt,
      quantity: qty,
      note: note.trim() || null,
    });
  };

  const score = result ? Number(result.totalScore) : null;
  const grade = score === null ? null : getGrade(score);

  return (
    <Tabs defaultValue="record" className="flex flex-col gap-4">
      <TabsList className="w-fit">
        <TabsTrigger value="record">Penilaian Karyawan</TabsTrigger>
        <TabsTrigger value="approvals">
          Persetujuan{pending.length > 0 ? ` (${pending.length})` : ""}
        </TabsTrigger>
      </TabsList>

      {/* ── Tab: catat & lihat penilaian satu karyawan ───────────────────── */}
      <TabsContent value="record" className="mt-0 flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-4 rounded-lg border p-4 sm:grid-cols-3">
          <div className="grid gap-1.5">
            <Label>Karyawan</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih karyawan..." />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                    <span className="text-muted-foreground ml-1">
                      — {u.role} · {u.branchName}
                    </span>
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

        {!userId ? (
          <Alert>
            <IconAlertCircle className="size-4" />
            <AlertDescription>
              Pilih karyawan untuk melihat dan mencatat penilaian KPI-nya.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            {/* Ringkasan skor */}
            <section className="border-border flex flex-wrap items-end justify-between gap-4 border-y py-6">
              <MetricBlock
                label={`Skor KPI ${MONTH_NAMES[Number(month)]} ${year}`}
                size="primary"
                tone={grade?.tone ?? "default"}
                value={score === null ? "—" : formatPercent(score)}
                meta={
                  result
                    ? `Grade ${result.grade} · dihitung ${new Date(result.calculatedAt).toLocaleString("id-ID")}`
                    : "Belum pernah dihitung untuk periode ini"
                }
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => collectMutation.mutate("employee")}
                  disabled={collectMutation.isPending || isLocked}
                >
                  <IconDownload className="size-4" />
                  {collectMutation.isPending ? "Menarik..." : "Tarik dari Absensi"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => recalcMutation.mutate()}
                  disabled={recalcMutation.isPending}
                >
                  <IconRefresh className="size-4" />
                  {recalcMutation.isPending ? "Menghitung..." : "Hitung Ulang"}
                </Button>
                <Button
                  size="sm"
                  variant={isLocked ? "outline" : "default"}
                  onClick={() => periodMutation.mutate(isLocked ? "UNLOCK" : "LOCK")}
                  disabled={periodMutation.isPending}
                >
                  {isLocked ? <IconLockOpen className="size-4" /> : <IconLock className="size-4" />}
                  {isLocked ? "Buka Periode" : "Kunci Periode"}
                </Button>
              </div>
            </section>

            {isLocked && (
              <Alert>
                <IconLock className="size-4" />
                <AlertDescription>
                  Periode ini terkunci{period?.lockedBy ? ` oleh ${period.lockedBy.name}` : ""}.
                  Entri tidak bisa ditambah, disetujui, atau dihapus sampai dibuka kembali.
                </AlertDescription>
              </Alert>
            )}

            {/* Hasil penarikan otomatis + hari yang perlu diperiksa manual */}
            {result?.breakdownJson?.autoCollected?.length ? (
              <div className="flex flex-col gap-3 rounded-lg border p-4">
                <div className="flex items-center gap-2">
                  <IconDownload className="text-muted-foreground size-4" />
                  <h3 className="text-sm font-medium">Data yang ditarik otomatis</h3>
                </div>

                {result.breakdownJson.autoCollected.map((c) => (
                  <div key={c.roleKpiId} className="flex flex-col gap-1.5">
                    <p className="text-sm">
                      <span className="font-medium">{c.kpiName}</span>
                      <span className="text-muted-foreground"> · {c.collectorLabel} · </span>
                      <span className="tabular">{c.entryCount}</span>
                      <span className="text-muted-foreground"> hari tercatat</span>
                    </p>

                    {c.skipped.length > 0 && (
                      <div className="border-warning/40 bg-warning/5 rounded-md border px-3 py-2">
                        <p className="text-xs font-medium">
                          {c.skipped.length} hari dilewati — perlu diperiksa manual
                        </p>
                        <ul className="text-muted-foreground mt-1 flex flex-col gap-0.5 text-xs">
                          {c.skipped.slice(0, 6).map((s) => (
                            <li key={`${c.roleKpiId}-${s.date}`}>
                              {new Date(s.date).toLocaleDateString("id-ID", {
                                day: "numeric",
                                month: "short",
                              })}
                              {" — "}
                              {s.reason}
                            </li>
                          ))}
                          {c.skipped.length > 6 && (
                            <li>…dan {c.skipped.length - 6} hari lainnya</li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}

                {result.breakdownJson.autoUnsupported?.length ? (
                  <Alert variant="destructive">
                    <IconAlertCircle className="size-4" />
                    <AlertDescription>
                      KPI berikut disetel diisi otomatis tapi belum ada kolektornya, sehingga
                      nilainya akan selalu kosong:{" "}
                      {result.breakdownJson.autoUnsupported.map((u) => u.kpiName).join(", ")}.
                    </AlertDescription>
                  </Alert>
                ) : null}
              </div>
            ) : null}

            {/* Rincian per KPI */}
            {result && result.breakdownJson?.items?.length > 0 && (
              <div className="bg-card overflow-hidden rounded-xl border shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>KPI</TableHead>
                      <TableHead className="text-right">Bobot</TableHead>
                      <TableHead>Perhitungan</TableHead>
                      <TableHead className="text-right">Mgg 1–4</TableHead>
                      <TableHead className="text-right">Pencapaian</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.breakdownJson.items.map((item) => (
                      <TableRow key={item.roleKpiId}>
                        <TableCell className="font-medium">
                          {item.kpiName}
                          {item.noData && (
                            <span className="text-muted-foreground ml-1 text-[11px] font-normal">
                              · belum ada data
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="tabular text-right">
                          {(item.weight * 100).toFixed(0)}%
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {item.explanation}
                        </TableCell>
                        <TableCell className="tabular text-muted-foreground text-right text-xs">
                          {item.weeklyTotals
                            .slice(0, 4)
                            .map((w) => w.toLocaleString("id-ID"))
                            .join(" · ")}
                        </TableCell>
                        <TableCell className="tabular text-right font-medium">
                          {formatPercent(item.achievement)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Form pencatatan */}
            <div className="bg-muted/30 flex flex-col gap-4 rounded-lg border p-4">
              <h3 className="text-sm font-medium">
                Catat KPI untuk {selectedUser?.name ?? "karyawan"}
              </h3>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="grid gap-1.5">
                  <Label>KPI *</Label>
                  <Select value={roleKpiId} onValueChange={setRoleKpiId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih KPI..." />
                    </SelectTrigger>
                    <SelectContent>
                      {recordable.map((rk) => (
                        <SelectItem key={rk.id} value={rk.id}>
                          {rk.definition.name}
                          <span className="text-muted-foreground ml-1">
                            — {SCORING_TYPE_LABELS[rk.definition.scoringType] ??
                              rk.definition.scoringType}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Tanggal Kejadian *</Label>
                  <Input
                    type="date"
                    value={occurredAt}
                    onChange={(e) => setOccurredAt(e.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>
                    {selectedKpi?.definition.unit === "CURRENCY" ? "Nilai (Rp)" : "Jumlah"} *
                  </Label>
                  <Input
                    type="number"
                    step="any"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                </div>
              </div>

              {selectedKpi?.definition.description && (
                <p className="text-muted-foreground border-border border-l-2 pl-2 text-xs">
                  {selectedKpi.definition.description}
                </p>
              )}

              <div className="grid gap-1.5">
                <Label>Keterangan</Label>
                <Textarea
                  rows={2}
                  placeholder="Contoh: Komplain nasabah atas nama Budi, transfer tertunda 2 hari."
                  value={note}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNote(e.target.value)}
                />
              </div>

              <Button onClick={handleAdd} disabled={addMutation.isPending || isLocked} className="w-fit">
                {addMutation.isPending ? "Menyimpan..." : "+ Catat"}
              </Button>
            </div>

            {/* Daftar entri periode ini */}
            <div className="bg-card overflow-hidden rounded-xl border shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>KPI</TableHead>
                    <TableHead className="text-right">Jumlah</TableHead>
                    <TableHead>Sumber</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Keterangan</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entriesLoading ? (
                    <TableSkeletonRows cols={7} />
                  ) : entries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-muted-foreground py-6 text-center">
                        Belum ada catatan KPI untuk periode ini.
                      </TableCell>
                    </TableRow>
                  ) : (
                    entries.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(e.occurredAt).toLocaleDateString("id-ID")}
                          <span className="ml-1 text-[11px]">· mgg {e.weekOfMonth}</span>
                        </TableCell>
                        <TableCell className="font-medium">{e.roleKpi.definition.name}</TableCell>
                        <TableCell className="tabular text-right">
                          {Number(e.quantity).toLocaleString("id-ID")}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {INPUT_SOURCE_LABELS[e.source] ?? e.source}
                          {e.createdBy ? (
                            <div>oleh {e.createdBy.name}</div>
                          ) : e.source === "SYSTEM" ? (
                            <div>dari absensi</div>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <Badge variant={STATUS_META[e.status].variant}>
                            {STATUS_META[e.status].label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {e.note ?? "—"}
                          {e.evidenceUrl && (
                            <>
                              {" "}
                              <a
                                href={e.evidenceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary underline"
                              >
                                bukti
                              </a>
                            </>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            {e.status === "PENDING" && !isLocked && (
                              <>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="text-success hover:text-success"
                                  disabled={reviewMutation.isPending}
                                  onClick={() =>
                                    reviewMutation.mutate({ id: e.id, decision: "APPROVED" })
                                  }
                                >
                                  <IconCheck className="size-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="text-destructive hover:text-destructive"
                                  disabled={reviewMutation.isPending}
                                  onClick={() => {
                                    const reason = prompt("Alasan penolakan (opsional):");
                                    if (reason === null) return;
                                    reviewMutation.mutate({
                                      id: e.id,
                                      decision: "REJECTED",
                                      reviewNote: reason || undefined,
                                    });
                                  }}
                                >
                                  <IconX className="size-4" />
                                </Button>
                              </>
                            )}
                            {/* Entri hasil kolektor tidak bisa dihapus manual —
                                penarikan berikutnya akan menuliskannya lagi.
                                Kalau datanya salah, absensinya yang diperbaiki. */}
                            {!isLocked && e.source !== "SYSTEM" && (
                              <DeleteConfirmDialog
                                trigger={
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="text-destructive hover:text-destructive"
                                    disabled={deleteMutation.isPending}
                                  >
                                    <IconTrash className="size-4" />
                                  </Button>
                                }
                                title="Hapus entri KPI ini?"
                                description="Entri hilang permanen dan skor perlu dihitung ulang."
                                onConfirm={() => deleteMutation.mutate(e.id)}
                                loading={deleteMutation.isPending}
                              />
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </TabsContent>

      {/* ── Tab: antrian persetujuan lintas karyawan ─────────────────────── */}
      <TabsContent value="approvals" className="mt-0 flex flex-col gap-4">
        <p className="text-muted-foreground text-sm">
          Entri yang diisi sendiri oleh karyawan dan menunggu keputusan Anda. Selama masih
          menunggu, entri ini belum ikut dihitung ke skor.
        </p>

        <div className="bg-card overflow-hidden rounded-xl border shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Karyawan</TableHead>
                <TableHead>KPI</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead className="text-right">Jumlah</TableHead>
                <TableHead>Keterangan</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingLoading ? (
                <TableSkeletonRows cols={6} />
              ) : pending.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground py-6 text-center">
                    Tidak ada entri yang menunggu persetujuan.
                  </TableCell>
                </TableRow>
              ) : (
                pending.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.employee.name}</TableCell>
                    <TableCell>{e.roleKpi.definition.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(e.occurredAt).toLocaleDateString("id-ID")}
                    </TableCell>
                    <TableCell className="tabular text-right">
                      {Number(e.quantity).toLocaleString("id-ID")}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {e.note ?? "—"}
                      {e.evidenceUrl && (
                        <>
                          {" "}
                          <a
                            href={e.evidenceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary underline"
                          >
                            bukti
                          </a>
                        </>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={reviewMutation.isPending}
                          onClick={() => reviewMutation.mutate({ id: e.id, decision: "APPROVED" })}
                        >
                          <IconCheck className="size-4" />
                          Setujui
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          disabled={reviewMutation.isPending}
                          onClick={() => {
                            const reason = prompt("Alasan penolakan (opsional):");
                            if (reason === null) return;
                            reviewMutation.mutate({
                              id: e.id,
                              decision: "REJECTED",
                              reviewNote: reason || undefined,
                            });
                          }}
                        >
                          <IconX className="size-4" />
                          Tolak
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </TabsContent>
    </Tabs>
  );
}
