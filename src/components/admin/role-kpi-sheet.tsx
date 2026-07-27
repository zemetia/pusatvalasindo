"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AdminFormSidebar, AdminFormFooter } from "./admin-form-sidebar";
import { PremiumField, PremiumNativeSelect, FormSection } from "./premium-field";
import { NumericFormat } from "react-number-format";
import { KpiDefinitionRow, KPI_TYPE_LABELS } from "./kpi-definition-sheet";
import { Button } from "@/components/ui/button";
import { Sliders, Percent, Target, AlertTriangle, ShieldCheck, BarChart2 } from "lucide-react";

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  OWNER: "Owner",
  KEPALA_CABANG: "Kepala Cabang",
  KASIR: "Kasir",
  HR: "HR",
  AKUNTAN: "Akuntan",
};

export type RoleKpiRow = {
  id: string;
  roleName: string;
  kpiId: string;
  maxScore: string;
  targetValue: string | null;
  threshold: string | null;
  definition: { id: string; name: string; type: string };
};

interface Props {
  roleKpi?: RoleKpiRow;
  definitions: KpiDefinitionRow[];
  trigger?: React.ReactNode;
}

const empty = { roleName: "", kpiId: "", maxScore: "", targetValue: "", threshold: "" };

export function RoleKpiSheet({ roleKpi, definitions, trigger }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(empty);

  const isEdit = !!roleKpi;
  const selectedDef = definitions.find((d) => d.id === form.kpiId);

  useEffect(() => {
    if (open && roleKpi) {
      setForm({
        roleName: roleKpi.roleName,
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
    if (!form.roleName || !form.kpiId || !form.maxScore) {
      toast.error("Jabatan, KPI, dan max score wajib diisi");
      return;
    }
    const maxScore = parseFloat(form.maxScore);
    if (isNaN(maxScore) || maxScore <= 0 || maxScore > 1) {
      toast.error("Max score harus antara 0 dan 1 (contoh: 0.4)");
      return;
    }

    const body: Record<string, unknown> = isEdit
      ? {
          maxScore,
          targetValue: form.targetValue ? parseFloat(form.targetValue) : null,
          threshold: form.threshold ? parseFloat(form.threshold) : null,
        }
      : {
          roleName: form.roleName,
          kpiId: form.kpiId,
          maxScore,
          targetValue: form.targetValue ? parseFloat(form.targetValue) : undefined,
          threshold: form.threshold ? parseFloat(form.threshold) : undefined,
        };

    setLoading(true);
    try {
      const url = isEdit ? `/api/role-kpis/${roleKpi.id}` : "/api/role-kpis";
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
      toast.success(isEdit ? "Konfigurasi diperbarui" : "Konfigurasi ditambahkan");
      setOpen(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminFormSidebar
      open={open}
      onOpenChange={setOpen}
      title={isEdit ? "Edit Konfigurasi KPI" : "Tambah Konfigurasi KPI"}
      description="Tentukan bobot dan parameter penilaian KPI per jabatan."
      icon={<Sliders className="w-5 h-5" />}
      onSubmit={handleSubmit}
      trigger={
        trigger ?? (
          <Button className="gap-2">
            <Sliders className="w-4 h-4" />
            Tambah Konfigurasi
          </Button>
        )
      }
      footer={
        <AdminFormFooter
          onCancel={() => setOpen(false)}
          loading={loading}
          submitLabel={isEdit ? "Simpan Perubahan" : "Tambah"}
        />
      }
    >
      <FormSection title="Konfigurasi" icon={<ShieldCheck className="w-3.5 h-3.5" />}>
        <PremiumNativeSelect
          label="Jabatan *"
          icon={<ShieldCheck className="w-4 h-4" />}
          value={form.roleName}
          onValueChange={(val) => setForm((f) => ({ ...f, roleName: val }))}
          disabled={isEdit}
          placeholder="Pilih jabatan"
          options={Object.entries(ROLE_LABELS).map(([val, label]) => ({ value: val, label }))}
        />

        <PremiumNativeSelect
          label="Definisi KPI *"
          icon={<BarChart2 className="w-4 h-4" />}
          value={form.kpiId}
          onValueChange={(val) => setForm((f) => ({ ...f, kpiId: val }))}
          disabled={isEdit}
          placeholder="Pilih KPI"
          options={definitions.map((d) => ({
            value: d.id,
            label: `${d.name} — ${KPI_TYPE_LABELS[d.type] ?? d.type}`,
          }))}
        />

        <PremiumField
          label="Max Score * (0–1)"
          type="number"
          min="0.01"
          max="1"
          step="0.01"
          placeholder="Contoh: 0.4"
          value={form.maxScore}
          onChange={(e) => setForm((f) => ({ ...f, maxScore: e.target.value }))}
          icon={<Percent className="w-4 h-4" />}
        />
      </FormSection>

      {(selectedDef?.type === "EVENT" || selectedDef?.type === "TARGET") && (
        <FormSection title="Parameter" icon={<Target className="w-3.5 h-3.5" />}>
          {selectedDef.type === "EVENT" && (
            <PremiumField
              label="Threshold (poin maks sebelum skor 0)"
              type="number"
              min="1"
              placeholder="Contoh: 100"
              value={form.threshold}
              onChange={(e) => setForm((f) => ({ ...f, threshold: e.target.value }))}
              icon={<AlertTriangle className="w-4 h-4" />}
            />
          )}
          {selectedDef.type === "TARGET" && (
            <NumericFormat
              customInput={PremiumField}
              label="Target Value (IDR)"
              thousandSeparator="."
              decimalSeparator=","
              allowNegative={false}
              placeholder="Contoh: 100000000"
              value={form.targetValue}
              onValueChange={(v) => setForm((f) => ({ ...f, targetValue: v.value }))}
              icon={<Target className="w-4 h-4" />}
            />
          )}
        </FormSection>
      )}
    </AdminFormSidebar>
  );
}
