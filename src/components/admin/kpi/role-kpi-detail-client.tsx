"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { IconTrash, IconPencil, IconArrowLeft } from "@tabler/icons-react";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import type { KpiDefinitionRow } from "../kpi-definition-sheet";
import type { RoleKpiDetailRow } from "./role-kpi-detail-sheet";
import { RoleKpiDetailSheet } from "./role-kpi-detail-sheet";
import { MetricBlock } from "@/components/admin/page-shell";
import { SCORING_TYPE_LABELS, INPUT_SOURCE_LABELS } from "@/lib/kpi-utils";

type CompanyRow = { id: string; name: string; code: string };

/**
 * Warna segmen memakai ramp monokrom dari token `--primary` (bukan palet hex
 * mentah) supaya diagram tetap satu bahasa dengan sisa antarmuka dan ikut
 * berubah di mode gelap. Lihat docs/blueprint/DATA_PRESENTATION.md §9.
 */
function segmentColor(index: number, total: number) {
  const ratio = total <= 1 ? 1 : 1 - (index / (total - 1)) * 0.6;
  return `color-mix(in oklab, var(--primary) ${Math.round(ratio * 100)}%, var(--muted))`;
}

/** Ringkasan angka penilaian; hanya parameter yang relevan bagi tipenya. */
function scoringSummary(rk: RoleKpiDetailRow) {
  const num = (v: string | null) => (v === null ? null : Number(v));
  const fmt = (v: number) => v.toLocaleString("id-ID");

  const target = num(rk.targetValue);
  const base = num(rk.basePoint);
  const perUnit = num(rk.pointPerUnit);
  const tolerance = num(rk.toleranceLimit);
  const isCurrency = rk.definition.unit === "CURRENCY";

  switch (rk.definition.scoringType) {
    case "TARGET_VALUE":
      return target === null
        ? "target belum disetel"
        : `target ${isCurrency ? "Rp " : ""}${fmt(target)}`;
    case "PENALTY_POINT":
      return perUnit === null
        ? "poin per kejadian belum disetel"
        : `−${fmt(perUnit)} poin/kejadian dari ${fmt(base ?? 100)}`;
    case "REWARD_POINT":
      return perUnit === null || target === null
        ? "poin/target belum disetel"
        : `+${fmt(perUnit)} poin/kejadian, target ${fmt(target)}`;
    case "PENALTY_PERCENT":
      return perUnit === null ? "persen belum disetel" : `−${fmt(perUnit)}% per kejadian`;
    case "TOLERANCE_LIMIT": {
      if (tolerance === null || perUnit === null) return "batas belum disetel";
      const scope =
        rk.toleranceScope === "WEEKLY"
          ? "minggu"
          : rk.toleranceScope === "MONTHLY"
            ? "bulan"
            : "hari";
      return `maks ${isCurrency ? "Rp " : ""}${fmt(tolerance)}/${scope}, lewat → −${fmt(perUnit)} poin`;
    }
    case "BOOLEAN_DAILY":
      return "rasio hari patuh";
    default:
      return "—";
  }
}

function scoringTone(scoringType: string) {
  if (scoringType.startsWith("PENALTY") || scoringType === "TOLERANCE_LIMIT") return "warning";
  if (scoringType === "REWARD_POINT") return "success";
  return "info";
}

export function RoleKpiDetailClient({
  company,
  roleName,
  displayRoleName,
  roleKpis,
  definitions,
}: {
  company: CompanyRow;
  roleName: string;
  displayRoleName?: string;
  roleKpis: RoleKpiDetailRow[];
  definitions: KpiDefinitionRow[];
}) {
  const router = useRouter();

  const finalRoleName = displayRoleName || roleName;
  const customRoleId = roleName.replace("custom_", "");

  // Hanya KPI aktif yang dihitung engine, jadi hanya itu yang dijumlah bobotnya.
  const activeKpis = roleKpis.filter((rk) => rk.isActive);
  const totalWeight = activeKpis.reduce((sum, rk) => sum + Number(rk.weight), 0);
  const totalPct = Math.round(totalWeight * 100);
  const isComplete = Math.abs(totalWeight - 1) < 0.001;
  const configuredKpiIds = roleKpis.map((rk) => rk.kpiId);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/role-kpis/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Gagal menghapus");
    },
    onSuccess: () => {
      toast.success("KPI dihapus");
      router.refresh();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="text-muted-foreground mb-3 flex items-center gap-2 text-sm">
          <Link
            href="/dashboard/kpi"
            className="hover:text-foreground flex items-center gap-1 transition-colors"
          >
            <IconArrowLeft className="size-3.5" />
            KPI
          </Link>
          <span>/</span>
          <span>{company.name}</span>
          <span>/</span>
          <span className="text-foreground font-medium">{finalRoleName}</span>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{finalRoleName}</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Bobot, angka penilaian, dan siapa yang boleh mencatat tiap KPI di {company.name}
            </p>
          </div>
          <RoleKpiDetailSheet
            companyId={company.id}
            customRoleId={customRoleId}
            definitions={definitions}
            configuredKpiIds={configuredKpiIds}
            currentTotalPct={totalPct}
            trigger={<Button size="sm">+ Tambah KPI</Button>}
          />
        </div>
      </div>

      {activeKpis.length > 0 && (
        <section className="border-border flex flex-col gap-4 border-y py-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <MetricBlock
              label="Distribusi Bobot"
              size="secondary"
              tone={isComplete ? "default" : "destructive"}
              value={totalPct}
              suffix="%"
              meta={
                isComplete
                  ? `${activeKpis.length} KPI aktif · bobot lengkap`
                  : totalPct < 100
                    ? `${activeKpis.length} KPI aktif · kurang ${100 - totalPct}%`
                    : `${activeKpis.length} KPI aktif · lebih ${totalPct - 100}%`
              }
            />
          </div>

          <div className="bg-muted flex h-2 gap-px overflow-hidden rounded-full">
            {activeKpis.map((rk, i) => {
              const pct = Number(rk.weight) * 100;
              return (
                <div
                  key={rk.id}
                  title={`${rk.definition.name}: ${pct.toFixed(0)}%`}
                  className="h-full transition-all"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: segmentColor(i, activeKpis.length),
                  }}
                />
              );
            })}
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {activeKpis.map((rk, i) => (
              <div key={rk.id} className="flex items-center gap-1.5">
                <div
                  className="size-2 flex-shrink-0 rounded-sm"
                  style={{ backgroundColor: segmentColor(i, activeKpis.length) }}
                />
                <span className="text-muted-foreground text-xs">
                  {rk.definition.name}{" "}
                  <span className="text-foreground tabular font-medium">
                    ({(Number(rk.weight) * 100).toFixed(0)}%)
                  </span>
                </span>
              </div>
            ))}
          </div>

          {!isComplete && (
            <p className="text-muted-foreground text-xs">
              Skor tetap dihitung dengan menormalkan total bobot, tapi sebaiknya dirapikan ke 100%
              agar angkanya sama persis dengan sheet KPI.
            </p>
          )}
        </section>
      )}

      <div className="bg-card overflow-hidden rounded-xl border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama KPI</TableHead>
              <TableHead>Cara Penilaian</TableHead>
              <TableHead className="text-right">Bobot</TableHead>
              <TableHead>Angka Penilaian</TableHead>
              <TableHead>Diisi Oleh</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {roleKpis.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div>
                      <p className="text-foreground font-medium">
                        Belum ada KPI untuk jabatan ini
                      </p>
                      <p className="text-muted-foreground mt-1 text-sm">
                        Tambahkan KPI dan atur bobotnya hingga total 100%.
                      </p>
                    </div>
                    <RoleKpiDetailSheet
                      companyId={company.id}
                      customRoleId={customRoleId}
                      definitions={definitions}
                      configuredKpiIds={configuredKpiIds}
                      currentTotalPct={0}
                      trigger={
                        <Button size="sm" variant="outline">
                          + Tambah KPI Pertama
                        </Button>
                      }
                    />
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              roleKpis.map((rk, i) => {
                const source = rk.inputSource ?? rk.definition.defaultInputSource;
                const needsApproval = rk.requiresApproval ?? rk.definition.defaultRequiresApproval;
                return (
                  <TableRow key={rk.id} className={rk.isActive ? undefined : "opacity-55"}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <div
                          className="size-2 flex-shrink-0 rounded-sm"
                          style={{ backgroundColor: segmentColor(i, roleKpis.length) }}
                        />
                        {rk.definition.name}
                        {!rk.isActive && (
                          <span className="text-muted-foreground text-xs font-normal">
                            · nonaktif
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={scoringTone(rk.definition.scoringType)}>
                        {SCORING_TYPE_LABELS[rk.definition.scoringType] ??
                          rk.definition.scoringType}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular text-right">
                      {(Number(rk.weight) * 100).toFixed(0)}%
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {scoringSummary(rk)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-0.5">
                        <span className="text-sm">
                          {INPUT_SOURCE_LABELS[source] ?? source}
                          {rk.inputSource && (
                            <span className="text-muted-foreground text-[11px]"> (khusus)</span>
                          )}
                        </span>
                        {source === "SELF" && needsApproval && (
                          <span className="text-muted-foreground text-[11px]">
                            perlu persetujuan
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <RoleKpiDetailSheet
                          companyId={company.id}
                          customRoleId={customRoleId}
                          definitions={definitions}
                          roleKpi={rk}
                          configuredKpiIds={configuredKpiIds}
                          currentTotalPct={
                            totalPct - (rk.isActive ? Math.round(Number(rk.weight) * 100) : 0)
                          }
                          trigger={
                            <Button size="icon" variant="ghost">
                              <IconPencil className="size-4" />
                            </Button>
                          }
                        />
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
                          title={`Hapus KPI "${rk.definition.name}" dari jabatan ini?`}
                          description="Seluruh entri KPI yang tercatat di bawahnya ikut terhapus. Untuk menghentikan penilaian tanpa kehilangan riwayat, nonaktifkan saja lewat tombol edit."
                          onConfirm={() => deleteMutation.mutate(rk.id)}
                          loading={deleteMutation.isPending}
                        />
                      </div>
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
