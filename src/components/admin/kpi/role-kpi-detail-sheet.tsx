"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { IconInfoCircle } from "@tabler/icons-react";
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
  currentTotalPct: number;
  trigger?: React.ReactNode;
}

const empty = { kpiId: "", bobot: "", targetValue: "", threshold: "" };

function FieldLabel({
  children,
  tooltip,
}: {
  children: React.ReactNode;
  tooltip: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <Label>{children}</Label>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className="text-muted-foreground hover:text-foreground">
            <IconInfoCircle className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-56 text-xs">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

export function RoleKpiDetailSheet({
  companyId,
  customRoleId,
  definitions,
  roleKpi,
  configuredKpiIds,
  currentTotalPct,
  trigger,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
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
        bobot: String(Math.round(Number(roleKpi.maxScore) * 100)),
        targetValue: roleKpi.targetValue
          ? String(Number(roleKpi.targetValue))
          : "",
        threshold: roleKpi.threshold ? String(Number(roleKpi.threshold)) : "",
      });
    } else if (!open) {
      setForm(empty);
    }
  }, [open, roleKpi]);

  const saveMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const url = isEdit
        ? `/api/role-kpis/${roleKpi!.id}`
        : "/api/role-kpis";
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Gagal menyimpan");
      return data.data;
    },
    onSuccess: () => {
      toast.success(isEdit ? "KPI diperbarui" : "KPI ditambahkan");
      setOpen(false);
      router.refresh();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const bobotNum = parseFloat(form.bobot) || 0;
  const remaining = 100 - currentTotalPct;
  const afterFill = currentTotalPct + bobotNum;
  const barOverflow = afterFill > 100;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEdit && !form.kpiId) {
      toast.error("Pilih KPI terlebih dahulu");
      return;
    }
    if (!form.bobot || isNaN(bobotNum) || bobotNum <= 0 || bobotNum > 100) {
      toast.error("Bobot harus antara 1% dan 100%");
      return;
    }

    const maxScore = bobotNum / 100;

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
          targetValue: form.targetValue
            ? parseFloat(form.targetValue)
            : undefined,
          threshold: form.threshold ? parseFloat(form.threshold) : undefined,
        };

    saveMutation.mutate(body);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger ?? <Button>+ Tambah KPI</Button>}
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {isEdit ? "Edit Bobot KPI" : "Tambah KPI ke Jabatan Ini"}
          </SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 mt-6 px-1">
          {/* KPI selector */}
          <div className="grid gap-1.5">
            <Label>KPI *</Label>
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
                    {d.name}
                    <span className="ml-1 text-muted-foreground">
                      — {KPI_TYPE_LABELS[d.type] ?? d.type}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!isEdit && availableDefinitions.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Semua KPI sudah dikonfigurasi untuk jabatan ini.
              </p>
            )}
          </div>

          {/* Bobot % + live bar */}
          <div className="grid gap-2">
            <FieldLabel tooltip="Persentase kontribusi KPI ini terhadap total skor. Jumlah semua bobot harus mencapai 100%.">
              Bobot (%)
            </FieldLabel>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="1"
                max="100"
                step="1"
                placeholder="Contoh: 40"
                value={form.bobot}
                onChange={(e) =>
                  setForm((f) => ({ ...f, bobot: e.target.value }))
                }
                className="w-28"
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>

            {/* Live progress bar */}
            <div className="flex flex-col gap-1">
              <div className="h-2 rounded-full bg-muted overflow-hidden flex">
                <div
                  className="h-full bg-muted-foreground/30 transition-all"
                  style={{ width: `${Math.min(currentTotalPct, 100)}%` }}
                />
                {bobotNum > 0 && (
                  <div
                    className={`h-full transition-all ${
                      barOverflow ? "bg-destructive" : "bg-primary"
                    }`}
                    style={{
                      width: `${Math.min(bobotNum, Math.max(100 - currentTotalPct, 0))}%`,
                    }}
                  />
                )}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  Total setelah disimpan:{" "}
                  <span
                    className={`font-medium ${
                      barOverflow ? "text-destructive" : "text-foreground"
                    }`}
                  >
                    {afterFill.toFixed(0)}%
                  </span>
                </span>
                <span>
                  Sisa:{" "}
                  <span
                    className={`font-medium ${
                      remaining <= 0 ? "text-destructive" : "text-foreground"
                    }`}
                  >
                    {Math.max(remaining, 0).toFixed(0)}%
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* EVENT: Batas Poin */}
          {currentType === "EVENT" && (
            <div className="grid gap-1.5">
              <FieldLabel tooltip="Jika total poin pelanggaran melebihi angka ini dalam satu bulan, skor KPI menjadi 0.">
                Batas Poin Pelanggaran
              </FieldLabel>
              <Input
                type="number"
                min="1"
                placeholder="Contoh: 100"
                value={form.threshold}
                onChange={(e) =>
                  setForm((f) => ({ ...f, threshold: e.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Contoh: batas 100, pelanggaran 40 poin → skor 60% dari bobot.
              </p>
            </div>
          )}

          {/* TARGET: Target Omzet */}
          {currentType === "TARGET" && (
            <div className="grid gap-1.5">
              <FieldLabel tooltip="Target omzet yang harus dicapai karyawan per bulan. Pencapaian di atas 120% tidak dihitung lebih.">
                Target Omzet per Bulan (Rp)
              </FieldLabel>
              <NumberInput
                placeholder="Contoh: 50000000"
                value={form.targetValue}
                onValueChange={(val) =>
                  setForm((f) => ({ ...f, targetValue: val === undefined ? "" : String(val) }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Contoh: target Rp 50jt, omzet Rp 40jt → pencapaian 80% dari
                bobot.
              </p>
            </div>
          )}

          <Button
            type="submit"
            disabled={
              saveMutation.isPending ||
              (!isEdit && availableDefinitions.length === 0)
            }
          >
            {saveMutation.isPending
              ? "Menyimpan..."
              : isEdit
              ? "Simpan Perubahan"
              : "Tambah KPI"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
