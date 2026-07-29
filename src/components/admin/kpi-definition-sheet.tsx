"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { AdminFormSidebar, AdminFormFooter } from "./admin-form-sidebar";
import { PremiumField, PremiumNativeSelect, FormSection } from "./premium-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BarChart2, Tag, Layers, Hash, UserCheck, Target } from "lucide-react";

export const SCORING_TYPE_OPTIONS = [
  {
    value: "TARGET_VALUE",
    label: "Target Nilai",
    hint: "Realisasi dibagi target. Untuk omzet, net profit margin, jumlah pengiriman, jumlah briefing.",
  },
  {
    value: "PENALTY_POINT",
    label: "Penalti Poin per Kejadian",
    hint: "Mulai dari poin penuh, tiap kejadian mengurangi sekian poin. Contoh: −3 poin setiap kesalahan hitung.",
  },
  {
    value: "REWARD_POINT",
    label: "Reward Poin per Kejadian",
    hint: "Mulai dari nol, tiap kejadian menambah poin sampai target. Contoh: 1 Google review = +2 poin, target 50.",
  },
  {
    value: "PENALTY_PERCENT",
    label: "Penalti Persen per Kejadian",
    hint: "Mulai 100%, tiap kejadian memotong sekian persen. Contoh: −5% setiap telat update kurs.",
  },
  {
    value: "TOLERANCE_LIMIT",
    label: "Batas Toleransi",
    hint: "Ada ambang yang masih dimaklumi; yang melewatinya kena penalti. Contoh: selisih kas maks 100rb/hari.",
  },
  {
    value: "BOOLEAN_DAILY",
    label: "Checklist Harian",
    hint: "Rasio hari patuh terhadap hari yang dinilai. Untuk checklist in/out harian.",
  },
] as const;

export const INPUT_SOURCE_OPTIONS = [
  {
    value: "SELF",
    label: "Karyawan mengisi sendiri",
    hint: "Muncul di halaman Input KPI Saya. Cocok untuk hal yang hanya diketahui karyawan: omzet, Google review, briefing.",
  },
  {
    value: "SUPERVISOR",
    label: "Hanya atasan / HR",
    hint: "Tidak muncul di halaman karyawan. Wajib untuk temuan atas karyawan: komplain nasabah, pelanggaran SOP.",
  },
  {
    value: "SYSTEM",
    label: "Otomatis dari sistem",
    hint: "Diambil modul lain (mis. absensi). Tidak bisa dicatat manual oleh siapa pun.",
  },
] as const;

const UNIT_OPTIONS = [
  { value: "OCCURRENCE", label: "Kejadian" },
  { value: "CURRENCY", label: "Rupiah" },
  { value: "POINT", label: "Poin" },
  { value: "PERCENT", label: "Persen" },
  { value: "DAY", label: "Hari" },
  { value: "PERSON", label: "Orang" },
];

export type KpiDefinitionRow = {
  id: string;
  code: string;
  name: string;
  objective: string | null;
  description: string | null;
  scoringType: string;
  unit: string;
  direction: string;
  defaultInputSource: string;
  defaultRequiresApproval: boolean;
  defaultRequiresEvidence: boolean;
  systemSourceKey: string | null;
  isActive: boolean;
  _count: { roleKpis: number };
};

interface Props {
  definition?: KpiDefinitionRow;
  trigger?: React.ReactNode;
  onSaved?: () => void;
}

const empty = {
  code: "",
  name: "",
  objective: "",
  description: "",
  scoringType: "",
  unit: "OCCURRENCE",
  direction: "HIGHER_BETTER",
  defaultInputSource: "SUPERVISOR",
  defaultRequiresApproval: true,
  defaultRequiresEvidence: false,
  isActive: true,
};

/** Slug otomatis dari nama, supaya admin tidak perlu memikirkan kode. */
function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function KpiDefinitionSheet({ definition, trigger, onSaved }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  /** Kode berhenti mengikuti nama begitu admin mengetiknya sendiri. */
  const [codeTouched, setCodeTouched] = useState(false);

  const isEdit = !!definition;

  useEffect(() => {
    if (open && definition) {
      setForm({
        code: definition.code,
        name: definition.name,
        objective: definition.objective ?? "",
        description: definition.description ?? "",
        scoringType: definition.scoringType,
        unit: definition.unit,
        direction: definition.direction,
        defaultInputSource: definition.defaultInputSource,
        defaultRequiresApproval: definition.defaultRequiresApproval,
        defaultRequiresEvidence: definition.defaultRequiresEvidence,
        isActive: definition.isActive,
      });
      setCodeTouched(true);
    } else if (!open) {
      setForm(empty);
      setCodeTouched(false);
    }
  }, [open, definition]);

  const saveMutation = useMutation({
    mutationFn: async (body: typeof form) => {
      const url = isEdit ? `/api/kpi-definitions/${definition!.id}` : "/api/kpi-definitions";
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...body,
          objective: body.objective || null,
          description: body.description || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Gagal menyimpan");
      return data.data;
    },
    onSuccess: () => {
      toast.success(isEdit ? "Definisi KPI diperbarui" : "Definisi KPI ditambahkan");
      setOpen(false);
      onSaved?.();
      router.refresh();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.scoringType || !form.code) {
      toast.error("Nama, kode, dan cara penilaian wajib diisi");
      return;
    }
    saveMutation.mutate(form);
  };

  const scoringHint = SCORING_TYPE_OPTIONS.find((o) => o.value === form.scoringType)?.hint;
  const sourceHint = INPUT_SOURCE_OPTIONS.find((o) => o.value === form.defaultInputSource)?.hint;
  const isSystem = form.defaultInputSource === "SYSTEM";

  return (
    <AdminFormSidebar
      open={open}
      onOpenChange={setOpen}
      title={isEdit ? "Edit Definisi KPI" : "Tambah Definisi KPI"}
      description={
        isEdit
          ? "Ubah cara penilaian dan kebijakan pengisian KPI ini."
          : "Buat KPI baru: bagaimana dinilai dan siapa yang boleh mencatatnya."
      }
      icon={<BarChart2 className="w-5 h-5" />}
      onSubmit={handleSubmit}
      trigger={
        trigger ?? (
          <Button className="gap-2">
            <BarChart2 className="w-4 h-4" />
            Tambah Definisi KPI
          </Button>
        )
      }
      footer={
        <AdminFormFooter
          onCancel={() => setOpen(false)}
          loading={saveMutation.isPending}
          submitLabel={isEdit ? "Simpan Perubahan" : "Tambah"}
        />
      }
    >
      <FormSection title="Identitas" icon={<Tag className="w-4 h-4" />}>
        <PremiumField
          label="Nama KPI *"
          placeholder="Contoh: Ketelitian Perhitungan"
          value={form.name}
          onChange={(e) => {
            const name = e.target.value;
            setForm((f) => ({
              ...f,
              name,
              code: codeTouched ? f.code : slugify(name),
            }));
          }}
          icon={<Tag className="w-4 h-4" />}
        />

        <PremiumField
          label="Kode *"
          placeholder="ketelitian-perhitungan"
          value={form.code}
          onChange={(e) => {
            setCodeTouched(true);
            setForm((f) => ({ ...f, code: e.target.value }));
          }}
          icon={<Hash className="w-4 h-4" />}
          error={isEdit ? "Mengubah kode dapat memutus rujukan dari seed & integrasi" : undefined}
        />

        <PremiumField
          label="Objective"
          placeholder="Contoh: Meningkatkan pelayanan kepada customer"
          value={form.objective}
          onChange={(e) => setForm((f) => ({ ...f, objective: e.target.value }))}
        />

        <div className="w-full space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Aturan Penilaian (dibaca karyawan)
          </Label>
          <Textarea
            rows={2}
            placeholder="Contoh: 3 poin minus setiap kali ada kesalahan hitung."
            value={form.description}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
          />
        </div>
      </FormSection>

      <FormSection title="Cara Penilaian" icon={<Target className="w-4 h-4" />}>
        <PremiumNativeSelect
          label="Cara Penilaian *"
          icon={<Layers className="w-4 h-4" />}
          value={form.scoringType}
          onValueChange={(val) => setForm((f) => ({ ...f, scoringType: val }))}
          placeholder="Pilih cara penilaian"
          options={SCORING_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        />
        {scoringHint && (
          <p className="text-[11.5px] text-muted-foreground leading-relaxed pl-2 border-l-2 border-border">
            {scoringHint}
          </p>
        )}

        <PremiumNativeSelect
          label="Satuan"
          value={form.unit}
          onValueChange={(val) => setForm((f) => ({ ...f, unit: val }))}
          options={UNIT_OPTIONS}
        />

        {form.scoringType === "TARGET_VALUE" && (
          <PremiumNativeSelect
            label="Arah Nilai"
            value={form.direction}
            onValueChange={(val) => setForm((f) => ({ ...f, direction: val }))}
            options={[
              { value: "HIGHER_BETTER", label: "Makin besar makin baik" },
              { value: "LOWER_BETTER", label: "Makin kecil makin baik" },
            ]}
          />
        )}

        <p className="text-[11.5px] text-muted-foreground leading-relaxed pl-2 border-l-2 border-border">
          Angka konkretnya (target, poin per kejadian, batas toleransi) disetel per jabatan di
          halaman KPI Jabatan — satu KPI bisa punya bobot dan angka berbeda tiap jabatan.
        </p>
      </FormSection>

      <FormSection title="Siapa yang Mengisi" icon={<UserCheck className="w-4 h-4" />}>
        <PremiumNativeSelect
          label="Sumber Pengisian *"
          value={form.defaultInputSource}
          onValueChange={(val) => setForm((f) => ({ ...f, defaultInputSource: val }))}
          options={INPUT_SOURCE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        />
        {sourceHint && (
          <p className="text-[11.5px] text-muted-foreground leading-relaxed pl-2 border-l-2 border-border">
            {sourceHint}
          </p>
        )}

        <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
          <div className="space-y-0.5">
            <Label className="text-sm">Wajib disetujui atasan</Label>
            <p className="text-[11.5px] text-muted-foreground">
              Entri karyawan berstatus menunggu, baru dihitung setelah disetujui.
            </p>
          </div>
          <Checkbox
            checked={form.defaultRequiresApproval}
            disabled={isSystem}
            onCheckedChange={(checked) =>
              setForm((f) => ({ ...f, defaultRequiresApproval: checked === true }))
            }
          />
        </div>

        <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
          <div className="space-y-0.5">
            <Label className="text-sm">Wajib melampirkan bukti</Label>
            <p className="text-[11.5px] text-muted-foreground">
              Tautan foto/screenshot harus diisi saat mencatat.
            </p>
          </div>
          <Checkbox
            checked={form.defaultRequiresEvidence}
            disabled={isSystem}
            onCheckedChange={(checked) =>
              setForm((f) => ({ ...f, defaultRequiresEvidence: checked === true }))
            }
          />
        </div>

        <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
          <div className="space-y-0.5">
            <Label className="text-sm">Aktif</Label>
            <p className="text-[11.5px] text-muted-foreground">
              KPI nonaktif tidak muncul di form dan tidak ikut dihitung.
            </p>
          </div>
          <Checkbox
            checked={form.isActive}
            onCheckedChange={(checked) => setForm((f) => ({ ...f, isActive: checked === true }))}
          />
        </div>
      </FormSection>
    </AdminFormSidebar>
  );
}
