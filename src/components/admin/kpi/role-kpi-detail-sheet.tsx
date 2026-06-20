"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { KpiDefinitionRow, KPI_TYPE_LABELS } from "../kpi-definition-sheet";

export type RoleKpiDetailRow = {
  id: string;
  kpiId: string;
  maxScore: string;
  targetValue: string | null;
  threshold: string | null;
  weight: string;
  customRoleId: string | null;
  definition: { id: string; name: string; type: string };
};

interface Props {
  companyId: string;
   customRoleId: string;
  definitions: KpiDefinitionRow[];
  roleKpi?: RoleKpiDetailRow;
  configuredKpiIds: string[];
  trigger?: React.ReactNode;
}

const empty = { kpiId: "", maxScore: "", targetValue: "", threshold: "" };

export function RoleKpiDetailSheet({
  companyId,
  customRoleId,
  definitions,
  roleKpi,
  configuredKpiIds,
  trigger,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(empty);

  const isEdit = !!roleKpi;

  const currentType = useMemo(() => {
    const defId = isEdit ? roleKpi?.kpiId : form.kpiId;
    return definitions.find((d) => d.id === defId)?.type;
  }, [isEdit, roleKpi, form.kpiId, definitions]);

  const availableDefinitions = useMemo(() => {
    if (isEdit) return definitions;
    return definitions.filter((d) => !configuredKpiIds.includes(d.id));
  }, [definitions, configuredKpiIds, isEdit]);

  useEffect(() => {
    if (open && roleKpi) {
      setForm({
        kpiId: roleKpi.kpiId,
        maxScore: String(Number(roleKpi.maxScore)),
        targetValue: roleKpi.targetValue ? String(Number(roleKpi.targetValue)) : "",
        threshold: roleKpi.threshold ? String(Number(roleKpi.threshold)) : "",
      });
    } else if (!open) {
      setForm(empty);
    }
  }, [open, roleKpi]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEdit && !form.kpiId) {
      toast.error("Pilih definisi KPI");
      return;
    }
    const maxScore = parseFloat(form.maxScore);
    if (!form.maxScore || isNaN(maxScore) || maxScore <= 0 || maxScore > 1) {
      toast.error("Max score harus antara 0 dan 1 (contoh: 0.4)");
      return;
    }

    const body: Record<string, unknown> = isEdit
      ? {
          maxScore,
          weight: maxScore,
          targetValue: form.targetValue ? parseFloat(form.targetValue) : null,
          threshold: form.threshold ? parseFloat(form.threshold) : null,
        }
      : {
          companyId,
          customRoleId,
          kpiId: form.kpiId,
          maxScore,
          weight: maxScore,
          targetValue: form.targetValue ? parseFloat(form.targetValue) : undefined,
          threshold: form.threshold ? parseFloat(form.threshold) : undefined,
        };

    setLoading(true);
    try {
      const url = isEdit ? `/api/role-kpis/${roleKpi!.id}` : "/api/role-kpis";
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Gagal menyimpan");
        return;
      }
      toast.success(isEdit ? "KPI diperbarui" : "KPI ditambahkan");
      setOpen(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger ?? <Button>+ Tambah KPI</Button>}
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit Konfigurasi Bobot KPI" : "Tambah KPI"}</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-6 px-1">
          <div className="grid gap-1.5">
            <Label>Definisi KPI *</Label>
            <Select
              value={form.kpiId}
              onValueChange={(v) => setForm((f) => ({ ...f, kpiId: v }))}
              disabled={isEdit}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih KPI" />
              </SelectTrigger>
              <SelectContent>
                {availableDefinitions.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name} — {KPI_TYPE_LABELS[d.type] ?? d.type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!isEdit && availableDefinitions.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Semua definisi KPI sudah dikonfigurasi untuk jabatan ini.
              </p>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label>Bobot * (0–1, total bobot per jabatan harus = 1)</Label>
            <Input
              type="number"
              min="0.01"
              max="1"
              step="0.01"
              placeholder="Contoh: 0.4"
              value={form.maxScore}
              onChange={(e) => setForm((f) => ({ ...f, maxScore: e.target.value }))}
            />
          </div>

          {currentType === "EVENT" && (
            <div className="grid gap-1.5">
              <Label>Threshold (total poin sebelum skor 0)</Label>
              <Input
                type="number"
                min="1"
                placeholder="Contoh: 100"
                value={form.threshold}
                onChange={(e) => setForm((f) => ({ ...f, threshold: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Skor = bobot × MAX((threshold − total_pelanggaran) / threshold, 0)
              </p>
            </div>
          )}

          {currentType === "TARGET" && (
            <div className="grid gap-1.5">
              <Label>Target Value (target revenue dalam IDR)</Label>
              <Input
                type="number"
                min="1"
                placeholder="Contoh: 100000000"
                value={form.targetValue}
                onChange={(e) => setForm((f) => ({ ...f, targetValue: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Skor = bobot × MIN(actual / target, 1.2)
              </p>
            </div>
          )}

          <Button
            type="submit"
            disabled={loading || (!isEdit && availableDefinitions.length === 0)}
            className="mt-2"
          >
            {loading ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : "Tambah"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
