"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
  const isComplete = Math.abs(totalWeight - 1) < 0.001;
  const configuredKpiIds = roleKpis.map((rk) => rk.kpiId);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Hapus KPI "${name}" dari konfigurasi ini?`)) return;
    const res = await fetch(`/api/role-kpis/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.message || "Gagal menghapus");
      return;
    }
    toast.success("KPI dihapus");
    router.refresh();
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
          <span className="text-foreground font-medium">
            {finalRoleName}
          </span>
        </div>
 
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold">
              {finalRoleName}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Konfigurasi KPI untuk jabatan ini di {company.name}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <Badge
              variant={isComplete ? "default" : "destructive"}
              className="text-sm px-3 py-1"
            >
              Total: {(totalWeight * 100).toFixed(0)}%{" "}
              {isComplete ? "✓" : "(harus 100%)"}
            </Badge>
            <RoleKpiDetailSheet
              companyId={company.id}
              customRoleId={customRoleId}
              definitions={definitions}
              configuredKpiIds={configuredKpiIds}
              trigger={<Button size="sm">+ Tambah KPI</Button>}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama KPI</TableHead>
              <TableHead>Tipe</TableHead>
              <TableHead className="text-right">Bobot</TableHead>
              <TableHead className="text-right">Target / Threshold</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {roleKpis.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center text-muted-foreground py-10"
                >
                  Belum ada KPI yang dikonfigurasi untuk jabatan ini.
                </TableCell>
              </TableRow>
            ) : (
              roleKpis.map((rk) => (
                <TableRow key={rk.id}>
                  <TableCell className="font-medium">
                    {rk.definition.name}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        rk.definition.type === "EVENT" ? "destructive" : "default"
                      }
                    >
                      {KPI_TYPE_LABELS[rk.definition.type] ?? rk.definition.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {(Number(rk.maxScore) * 100).toFixed(0)}%
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {rk.definition.type === "EVENT"
                      ? rk.threshold
                        ? `thr: ${Number(rk.threshold).toLocaleString()}`
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
