"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AdminFormSidebar, AdminFormFooter } from "./admin-form-sidebar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PremiumField, PremiumNativeSelect } from "./premium-field";
import { BarChart2, Tag, Layers } from "lucide-react";

export const KPI_TYPE_LABELS: Record<string, string> = {
  EVENT: "Event / Pelanggaran",
  TARGET: "Target / Omzet",
};

export type KpiDefinitionRow = {
  id: string;
  name: string;
  type: string;
  _count: { roleKpis: number; logs: number };
};

interface Props {
  definition?: KpiDefinitionRow;
  trigger?: React.ReactNode;
  onSaved?: () => void;
}

const empty = { name: "", type: "" };

export function KpiDefinitionSheet({ definition, trigger, onSaved }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(empty);

  const isEdit = !!definition;

  useEffect(() => {
    if (open && definition) {
      setForm({ name: definition.name, type: definition.type });
    } else if (!open) {
      setForm(empty);
    }
  }, [open, definition]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.type) {
      toast.error("Nama dan tipe KPI wajib diisi");
      return;
    }
    setLoading(true);
    try {
      const url = isEdit ? `/api/kpi-definitions/${definition.id}` : "/api/kpi-definitions";
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Gagal menyimpan");
        return;
      }
      toast.success(isEdit ? "Definisi KPI diperbarui" : "Definisi KPI ditambahkan");
      setOpen(false);
      onSaved?.();
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminFormSidebar
      open={open}
      onOpenChange={setOpen}
      title={isEdit ? "Edit Definisi KPI" : "Tambah Definisi KPI"}
      description={
        isEdit
          ? "Ubah nama definisi KPI yang ada."
          : "Buat definisi KPI baru untuk penilaian performa."
      }
      icon={<BarChart2 className="w-5 h-5" />}
      onSubmit={handleSubmit}
      trigger={
        trigger ?? (
          <button style={{ background: "linear-gradient(to right, #dc2626, #f43f5e)", boxShadow: "0 4px 14px 0 rgba(220,38,38,0.35)" }} className="inline-flex items-center gap-2 h-10 px-5 rounded-xl text-[13px] font-bold uppercase tracking-widest text-white transition-all duration-200">
            <BarChart2 className="w-4 h-4" />
            Tambah Definisi KPI
          </button>
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
      <PremiumField
        label="Nama KPI *"
        placeholder="Contoh: Kesesuaian SOP"
        value={form.name}
        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        icon={<Tag className="w-4 h-4" />}
      />

      <PremiumNativeSelect
        label="Tipe *"
        icon={<Layers className="w-4 h-4" />}
        error={isEdit ? "Tipe tidak dapat diubah" : undefined}
        value={form.type}
        onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
        disabled={isEdit}
      >
        <option value="" disabled>Pilih tipe</option>
        {Object.entries(KPI_TYPE_LABELS).map(([val, label]) => (
          <option key={val} value={val}>
            {label}
          </option>
        ))}
      </PremiumNativeSelect>

      {form.type === "EVENT" && (
        <p className="text-[11.5px] text-zinc-500 dark:text-zinc-400 leading-relaxed pl-1 border-l-2 border-violet-400/40 dark:border-violet-400/25 ml-0.5">
          Skor dikurangi berdasarkan jumlah pelanggaran yang tercatat.
        </p>
      )}
      {form.type === "TARGET" && (
        <p className="text-[11.5px] text-zinc-500 dark:text-zinc-400 leading-relaxed pl-1 border-l-2 border-violet-400/40 dark:border-violet-400/25 ml-0.5">
          Skor dihitung dari pencapaian revenue vs target (maks 120%).
        </p>
      )}
    </AdminFormSidebar>
  );
}
