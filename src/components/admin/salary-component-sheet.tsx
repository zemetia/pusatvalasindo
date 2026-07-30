"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { NumericFormat } from "react-number-format";
import { AdminFormSidebar, AdminFormFooter } from "./admin-form-sidebar";
import { PremiumField, PremiumNativeSelect, FormSection } from "./premium-field";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Banknote, Building2, Layers, Tag } from "lucide-react";

export const KIND_OPTIONS = [
  {
    value: "ALLOWANCE",
    label: "Tunjangan (menambah)",
    hint: "Menambah gaji kotor. Contoh: uang pulsa, tunjangan komunikasi, alokasi BPJS tambahan.",
  },
  {
    value: "DEDUCTION",
    label: "Potongan (mengurangi)",
    hint: "Mengurangi gaji yang diterima. Contoh: iuran koperasi, cicilan seragam.",
  },
] as const;

export type SalaryComponentRow = {
  id: string;
  companyId: string | null;
  companyName: string | null;
  name: string;
  kind: "ALLOWANCE" | "DEDUCTION";
  defaultAmount: number | null;
  note: string | null;
  isActive: boolean;
};

type CompanyOption = { id: string; name: string };

interface Props {
  component?: SalaryComponentRow;
  companies: CompanyOption[];
  /** Boleh membuat komponen global (berlaku semua PT)? Hanya scope seluruh PT. */
  canCreateGlobal: boolean;
  trigger?: React.ReactNode;
}

const GLOBAL = "__global__";

const empty = {
  companyId: "",
  name: "",
  kind: "ALLOWANCE",
  defaultAmount: "",
  note: "",
  isActive: true,
};

export function SalaryComponentSheet({
  component,
  companies,
  canCreateGlobal,
  trigger,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);

  const isEdit = !!component;

  useEffect(() => {
    if (open && component) {
      setForm({
        companyId: component.companyId ?? GLOBAL,
        name: component.name,
        kind: component.kind,
        defaultAmount:
          component.defaultAmount === null ? "" : String(component.defaultAmount),
        note: component.note ?? "",
        isActive: component.isActive,
      });
    } else if (!open) {
      setForm(empty);
    }
  }, [open, component]);

  const set = (key: keyof typeof form) => (val: string | boolean) =>
    setForm((f) => ({ ...f, [key]: val }));

  const saveMutation = useMutation({
    mutationFn: async (body: typeof form) => {
      const url = component
        ? `/api/salary-components/${component.id}`
        : "/api/salary-components";
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: body.companyId === GLOBAL ? null : body.companyId,
          name: body.name,
          kind: body.kind,
          defaultAmount: body.defaultAmount ? parseFloat(body.defaultAmount) : null,
          note: body.note || null,
          isActive: body.isActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Gagal menyimpan");
      return data.data;
    },
    onSuccess: () => {
      toast.success(isEdit ? "Komponen gaji diperbarui" : "Komponen gaji ditambahkan");
      setOpen(false);
      router.refresh();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Nama komponen wajib diisi");
      return;
    }
    if (!form.companyId) {
      toast.error("Pilih PT pemilik komponen ini");
      return;
    }
    saveMutation.mutate(form);
  };

  const kindHint = KIND_OPTIONS.find((o) => o.value === form.kind)?.hint;

  return (
    <AdminFormSidebar
      open={open}
      onOpenChange={setOpen}
      title={isEdit ? "Edit Komponen Gaji" : "Tambah Komponen Gaji"}
      description="Tunjangan atau potongan tetap per bulan, di luar gaji pokok, uang makan, transport, jabatan, dan BPJS yang sudah baku."
      icon={<Banknote className="w-5 h-5" />}
      onSubmit={handleSubmit}
      trigger={trigger}
      footer={
        <AdminFormFooter
          onCancel={() => setOpen(false)}
          loading={saveMutation.isPending}
          submitLabel={isEdit ? "Simpan Perubahan" : "Tambah Komponen"}
        />
      }
    >
      <FormSection title="Komponen" icon={<Tag className="w-3.5 h-3.5" />}>
        <PremiumField
          label="Nama Komponen *"
          placeholder="mis. Tunjangan Pulsa"
          value={form.name}
          onChange={(e) => set("name")(e.target.value)}
          icon={<Tag className="w-4 h-4" />}
        />

        <PremiumNativeSelect
          label="Berlaku Untuk *"
          icon={<Building2 className="w-4 h-4" />}
          value={form.companyId}
          onValueChange={(val) => set("companyId")(val)}
          placeholder="Pilih PT"
          options={[
            ...(canCreateGlobal ? [{ value: GLOBAL, label: "Semua PT" }] : []),
            ...companies.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />

        <div className="space-y-1.5">
          <PremiumNativeSelect
            label="Jenis *"
            icon={<Layers className="w-4 h-4" />}
            value={form.kind}
            onValueChange={(val) => set("kind")(val)}
            options={KIND_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          />
          {kindHint && <p className="text-muted-foreground text-xs">{kindHint}</p>}
        </div>

        <div className="space-y-1.5">
          <NumericFormat
            customInput={PremiumField}
            label="Nilai Default (IDR)"
            thousandSeparator="."
            decimalSeparator=","
            allowNegative={false}
            placeholder="0"
            value={form.defaultAmount}
            onValueChange={(v) => set("defaultAmount")(v.value)}
            icon={<Banknote className="w-4 h-4" />}
          />
          <p className="text-muted-foreground text-xs">
            Hanya usulan saat komponen dipasang ke karyawan. Nilai yang dipakai
            menghitung gaji selalu yang tersimpan di profil karyawan.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Catatan</Label>
          <Textarea
            rows={2}
            placeholder="Keterangan singkat, mis. dasar kebijakannya."
            value={form.note}
            onChange={(e) => set("note")(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="salary-component-active"
            checked={form.isActive}
            onCheckedChange={(v) => set("isActive")(v === true)}
          />
          <Label htmlFor="salary-component-active" className="text-xs font-normal">
            Aktif — komponen nonaktif tidak ikut dihitung, tapi nilainya di tiap
            karyawan tetap tersimpan.
          </Label>
        </div>
      </FormSection>
    </AdminFormSidebar>
  );
}
