"use client";

import { useState, useMemo } from "react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Combobox } from "@/components/ui/combobox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { IconTrash, IconLock } from "@tabler/icons-react";
import { MONTH_NAMES, SCORING_TYPE_LABELS } from "@/lib/kpi-utils";

type FillableKpi = {
  roleKpiId: string;
  name: string;
  description: string | null;
  scoringType: string;
  unit: string;
  requiresApproval: boolean;
  requiresEvidence: boolean;
  targetValue: string | null;
  pointPerUnit: string | null;
  toleranceLimit: string | null;
};

type EntryRow = {
  id: string;
  roleKpiId: string;
  occurredAt: string;
  weekOfMonth: number;
  quantity: string;
  note: string | null;
  evidenceUrl: string | null;
  source: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewNote: string | null;
  reviewedBy: { name: string } | null;
  roleKpi: { definition: { name: string; scoringType: string; unit: string } };
};

type PeriodRow = { status: "OPEN" | "LOCKED" } | null;

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
  PENDING: { label: "Menunggu persetujuan", variant: "warning" },
  APPROVED: { label: "Disetujui", variant: "success" },
  REJECTED: { label: "Ditolak", variant: "destructive" },
} as const satisfies Record<EntryRow["status"], { label: string; variant: BadgeVariant }>;

/** Label kolom jumlah menyesuaikan cara penilaian KPI yang dipilih. */
function quantityLabel(kpi: FillableKpi | undefined) {
  if (!kpi) return "Jumlah";
  if (kpi.unit === "CURRENCY") return "Nilai (Rp)";
  switch (kpi.scoringType) {
    case "TARGET_VALUE":
      return "Realisasi";
    case "REWARD_POINT":
    case "PENALTY_POINT":
    case "PENALTY_PERCENT":
      return "Jumlah Kejadian";
    case "BOOLEAN_DAILY":
      return "Patuh? (1 = ya, 0 = tidak)";
    default:
      return "Jumlah";
  }
}

/** Penjelasan singkat efek entri ini terhadap skor, dibaca sebelum menyimpan. */
function effectHint(kpi: FillableKpi | undefined, quantity: number) {
  if (!kpi || !Number.isFinite(quantity) || quantity === 0) return null;
  const perUnit = kpi.pointPerUnit ? Number(kpi.pointPerUnit) : null;

  switch (kpi.scoringType) {
    case "REWARD_POINT":
      return perUnit
        ? `Menambah ${(quantity * perUnit).toLocaleString("id-ID")} poin${
            kpi.targetValue ? ` dari target ${Number(kpi.targetValue).toLocaleString("id-ID")}` : ""
          }.`
        : null;
    case "PENALTY_POINT":
      return perUnit
        ? `Mengurangi ${(quantity * perUnit).toLocaleString("id-ID")} poin dari nilai KPI ini.`
        : null;
    case "PENALTY_PERCENT":
      return perUnit ? `Mengurangi ${(quantity * perUnit).toFixed(0)}% dari nilai KPI ini.` : null;
    case "TARGET_VALUE":
      return kpi.targetValue
        ? `Menambah realisasi menuju target ${Number(kpi.targetValue).toLocaleString("id-ID")}.`
        : null;
    case "TOLERANCE_LIMIT":
      return kpi.toleranceLimit
        ? `Batas yang ditoleransi ${Number(kpi.toleranceLimit).toLocaleString("id-ID")} per hari.`
        : null;
    default:
      return null;
  }
}

export function KpiSelfFillClient({
  userId,
  userName,
  roleName,
  companyName,
  fillableKpis,
  supervisorOnlyCount,
}: {
  userId: string;
  userName: string;
  roleName: string;
  companyName: string;
  fillableKpis: FillableKpi[];
  supervisorOnlyCount: number;
}) {
  const now = new Date();
  const queryClient = useQueryClient();

  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));

  const todayIso = now.toISOString().slice(0, 10);
  const [roleKpiId, setRoleKpiId] = useState("");
  const [occurredAt, setOccurredAt] = useState(todayIso);
  const [quantity, setQuantity] = useState("1");
  const [note, setNote] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const selectedKpi = fillableKpis.find((k) => k.roleKpiId === roleKpiId);
  const dataKey = ["kpi-entries-self", userId, month, year] as const;

  const { data, isLoading } = useQuery({
    queryKey: dataKey,
    queryFn: () =>
      fetchJson<{ entries: EntryRow[]; period: PeriodRow }>(
        `/api/kpi-entries?employeeId=${userId}&month=${month}&year=${year}`
      ),
  });

  const entries = useMemo(() => data?.entries ?? [], [data]);
  const isLocked = data?.period?.status === "LOCKED";

  const addMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => mutateJson("/api/kpi-entries", "POST", body),
    onSuccess: (_res, _vars) => {
      toast.success(
        selectedKpi?.requiresApproval
          ? "Tercatat — menunggu persetujuan atasan"
          : "KPI berhasil dicatat"
      );
      setQuantity("1");
      setNote("");
      setEvidenceUrl("");
      queryClient.invalidateQueries({ queryKey: dataKey });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => {
      setDeletingId(id);
      return mutateJson(`/api/kpi-entries/${id}`, "DELETE");
    },
    onSuccess: () => {
      toast.success("Entri dihapus");
      queryClient.invalidateQueries({ queryKey: dataKey });
    },
    onError: (err: Error) => toast.error(err.message),
    onSettled: () => setDeletingId(null),
  });

  const handleAdd = () => {
    if (!roleKpiId) {
      toast.error("Pilih KPI terlebih dahulu");
      return;
    }
    const qty = Number(quantity);
    if (!Number.isFinite(qty)) {
      toast.error("Jumlah harus berupa angka");
      return;
    }
    if (selectedKpi?.requiresEvidence && !evidenceUrl.trim()) {
      toast.error("KPI ini wajib disertai tautan bukti");
      return;
    }

    addMutation.mutate({
      employeeId: userId,
      roleKpiId,
      occurredAt,
      quantity: qty,
      note: note.trim() || null,
      evidenceUrl: evidenceUrl.trim() || null,
    });
  };

  const hint = effectHint(selectedKpi, Number(quantity));

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-muted/40 flex items-center gap-3 rounded-lg border px-4 py-3">
        <div>
          <p className="font-semibold">{userName}</p>
          <p className="text-muted-foreground text-sm">
            {roleName}
            {companyName ? ` · ${companyName}` : ""}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 rounded-lg border p-4">
        <div className="grid gap-1.5">
          <Label>Bulan</Label>
          <Combobox
            value={month}
            onValueChange={setMonth}
            options={MONTH_NAMES.slice(1).map((name, i) => ({
              value: String(i + 1),
              label: name,
            }))}
            searchPlaceholder="Cari bulan..."
          />
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

      {isLocked && (
        <div className="border-warning/40 bg-warning/10 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm">
          <IconLock className="size-4 shrink-0" />
          <span>
            Periode {MONTH_NAMES[Number(month)]} {year} sudah dikunci. Catatan tidak bisa
            ditambah atau dihapus lagi.
          </span>
        </div>
      )}

      {fillableKpis.length === 0 ? (
        <div className="bg-muted/30 flex flex-col gap-2 rounded-lg border px-4 py-3">
          <p className="text-sm font-medium">Tidak ada KPI yang bisa Anda isi sendiri</p>
          <p className="text-muted-foreground text-sm">
            Seluruh KPI jabatan <span className="font-medium">{roleName}</span> dicatat oleh atasan
            atau diambil otomatis oleh sistem. Anda tetap bisa melihat hasilnya di halaman KPI.
          </p>
        </div>
      ) : (
        <div className="bg-muted/30 flex flex-col gap-4 rounded-lg border p-4">
          <div>
            <h3 className="text-sm font-medium">Catat KPI</h3>
            {supervisorOnlyCount > 0 && (
              <p className="text-muted-foreground mt-0.5 text-xs">
                {supervisorOnlyCount} KPI lain pada jabatan Anda dicatat oleh atasan/sistem dan
                tidak muncul di sini.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>KPI *</Label>
              <Combobox
                value={roleKpiId}
                onValueChange={setRoleKpiId}
                options={fillableKpis.map((k) => ({
                  value: k.roleKpiId,
                  label: k.name,
                  description:
                    SCORING_TYPE_LABELS[k.scoringType] ?? k.scoringType,
                }))}
                placeholder="Pilih KPI..."
                searchPlaceholder="Cari KPI..."
                emptyText="KPI tidak ditemukan."
              />
            </div>

            <div className="grid gap-1.5">
              <Label>Tanggal Kejadian *</Label>
              <Input
                type="date"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
              />
            </div>
          </div>

          {selectedKpi?.description && (
            <p className="text-muted-foreground border-border border-l-2 pl-2 text-xs">
              {selectedKpi.description}
            </p>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>{quantityLabel(selectedKpi)} *</Label>
              <Input
                type="number"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
              {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
            </div>

            <div className="grid gap-1.5">
              <Label>
                Tautan Bukti {selectedKpi?.requiresEvidence ? "*" : "(opsional)"}
              </Label>
              <Input
                type="url"
                placeholder="https://..."
                value={evidenceUrl}
                onChange={(e) => setEvidenceUrl(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Keterangan</Label>
            <Textarea
              placeholder="Contoh: 3 ulasan Google dari nasabah transfer Singapura."
              rows={2}
              value={note}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNote(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleAdd} disabled={addMutation.isPending || isLocked}>
              {addMutation.isPending ? "Menyimpan..." : "+ Catat"}
            </Button>
            {selectedKpi?.requiresApproval && (
              <span className="text-muted-foreground text-xs">
                Entri ini menunggu persetujuan atasan sebelum ikut dihitung.
              </span>
            )}
          </div>
        </div>
      )}

      <div className="bg-card overflow-hidden rounded-xl border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tanggal</TableHead>
              <TableHead>KPI</TableHead>
              <TableHead className="text-right">Jumlah</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Keterangan</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeletonRows cols={6} />
            ) : entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground py-6 text-center">
                  Belum ada catatan untuk periode ini.
                </TableCell>
              </TableRow>
            ) : (
              entries.map((e) => {
                const meta = STATUS_META[e.status];
                return (
                  <TableRow key={e.id}>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(e.occurredAt).toLocaleDateString("id-ID")}
                      <span className="ml-1 text-[11px]">· mgg {e.weekOfMonth}</span>
                    </TableCell>
                    <TableCell className="font-medium">
                      {e.roleKpi.definition.name}
                      {e.source !== "SELF" && (
                        <span className="text-muted-foreground ml-1 text-[11px] font-normal">
                          (dicatat atasan)
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="tabular text-right">
                      {Number(e.quantity).toLocaleString("id-ID")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                      {e.status === "REJECTED" && e.reviewNote && (
                        <p className="text-muted-foreground mt-0.5 text-[11px]">{e.reviewNote}</p>
                      )}
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
                      {/* Entri yang sudah disetujui hanya bisa dibatalkan atasan —
                          supaya karyawan tidak menghapus penilaian atas dirinya. */}
                      {e.source === "SELF" && e.status !== "APPROVED" && !isLocked && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          disabled={deletingId === e.id}
                          onClick={() => {
                            if (!confirm("Hapus catatan ini?")) return;
                            deleteMutation.mutate(e.id);
                          }}
                        >
                          <IconTrash className="size-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
