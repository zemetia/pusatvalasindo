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
import { KpiDefinitionRow, KPI_TYPE_LABELS } from "../kpi-definition-sheet";
import { RoleKpiDetailSheet, RoleKpiDetailRow } from "./role-kpi-detail-sheet";

type CompanyRow = { id: string; name: string; code: string };

const SEGMENT_COLORS = [
  "#2563eb", "#7c3aed", "#0891b2", "#16a34a",
  "#d97706", "#dc2626", "#db2777", "#64748b",
];

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

  const totalWeight = roleKpis.reduce((sum, rk) => sum + Number(rk.maxScore), 0);
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

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Hapus KPI "${name}" dari konfigurasi ini?`)) return;
    deleteMutation.mutate(id);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb + header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
          <Link
            href="/dashboard/kpi"
            className="flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <IconArrowLeft className="size-3.5" />
            KPI
          </Link>
          <span>/</span>
          <span>{company.name}</span>
          <span>/</span>
          <span className="text-foreground font-medium">{finalRoleName}</span>
        </div>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold">{finalRoleName}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Konfigurasi KPI untuk jabatan ini di {company.name}
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

      {/* Weight distribution bar */}
      {roleKpis.length > 0 && (
        <div className="rounded-lg border p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Distribusi Bobot</span>
            <Badge variant={isComplete ? "default" : "destructive"}>
              {totalPct}%{" "}
              {isComplete ? "✓" : `— kurang ${100 - totalPct}%`}
            </Badge>
          </div>

          {/* Stacked bar */}
          <div className="h-3 rounded-full bg-muted overflow-hidden flex gap-px">
            {roleKpis.map((rk, i) => {
              const pct = Number(rk.maxScore) * 100;
              return (
                <div
                  key={rk.id}
                  title={`${rk.definition.name}: ${pct.toFixed(0)}%`}
                  className="h-full transition-all"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
                    borderRadius:
                      i === 0
                        ? "4px 0 0 4px"
                        : i === roleKpis.length - 1
                        ? "0 4px 4px 0"
                        : undefined,
                  }}
                />
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {roleKpis.map((rk, i) => (
              <div key={rk.id} className="flex items-center gap-1.5">
                <div
                  className="size-2 rounded-sm flex-shrink-0"
                  style={{
                    backgroundColor: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
                  }}
                />
                <span className="text-xs text-muted-foreground">
                  {rk.definition.name}{" "}
                  <span className="font-medium text-foreground">
                    ({(Number(rk.maxScore) * 100).toFixed(0)}%)
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama KPI</TableHead>
              <TableHead>Tipe</TableHead>
              <TableHead className="text-right">Bobot</TableHead>
              <TableHead className="text-right">Target / Batas Poin</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {roleKpis.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="text-3xl">📋</div>
                    <div>
                      <p className="font-medium text-foreground">
                        Belum ada KPI untuk jabatan ini
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
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
              roleKpis.map((rk, i) => (
                <TableRow key={rk.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <div
                        className="size-2 rounded-sm flex-shrink-0"
                        style={{
                          backgroundColor:
                            SEGMENT_COLORS[i % SEGMENT_COLORS.length],
                        }}
                      />
                      {rk.definition.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        rk.definition.type === "EVENT"
                          ? "destructive"
                          : "default"
                      }
                    >
                      {KPI_TYPE_LABELS[rk.definition.type] ??
                        rk.definition.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {(Number(rk.maxScore) * 100).toFixed(0)}%
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {rk.definition.type === "EVENT"
                      ? rk.threshold
                        ? `batas ${Number(rk.threshold).toLocaleString()} poin`
                        : "—"
                      : rk.targetValue
                      ? `Rp ${Number(rk.targetValue).toLocaleString("id-ID")}`
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 justify-end">
                      <RoleKpiDetailSheet
                        companyId={company.id}
                        customRoleId={customRoleId}
                        definitions={definitions}
                        roleKpi={rk}
                        configuredKpiIds={configuredKpiIds}
                        currentTotalPct={
                          totalPct - Math.round(Number(rk.maxScore) * 100)
                        }
                        trigger={
                          <Button size="icon" variant="ghost">
                            <IconPencil className="size-4" />
                          </Button>
                        }
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        disabled={deleteMutation.isPending}
                        onClick={() => handleDelete(rk.id, rk.definition.name)}
                      >
                        <IconTrash className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
