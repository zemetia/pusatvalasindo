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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { IconInfoCircle } from "@tabler/icons-react";
import { KpiDefinitionRow, INPUT_SOURCE_OPTIONS } from "../kpi-definition-sheet";
import { SCORING_TYPE_LABELS } from "@/lib/kpi-utils";

export type RoleKpiDetailRow = {
  id: string;
  kpiId: string;
  weight: string;
  targetValue: string | null;
  basePoint: string | null;
  pointPerUnit: string | null;
  toleranceLimit: string | null;
  toleranceScope: string | null;
  maxAchievement: string;
  inputSource: string | null;
  requiresApproval: boolean | null;
  requiresEvidence: boolean | null;
  isActive: boolean;
  customRoleId: string | null;
  definition: {
    id: string;
    name: string;
    scoringType: string;
    unit: string;
    description: string | null;
    defaultInputSource: string;
    defaultRequiresApproval: boolean;
    defaultRequiresEvidence: boolean;
  };
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

const empty = {
  kpiId: "",
  bobot: "",
  targetValue: "",
  basePoint: "100",
  pointPerUnit: "",
  toleranceLimit: "",
  toleranceScope: "DAILY",
  maxAchievement: "120",
  inputSource: "",
  requiresApproval: "",
  requiresEvidence: "",
  isActive: true,
};

function FieldLabel({ children, tooltip }: { children: React.ReactNode; tooltip: string }) {
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

/** Parameter mana yang relevan untuk tiap cara penilaian. */
function fieldsFor(scoringType: string | undefined) {
  switch (scoringType) {
    case "TARGET_VALUE":
      return { target: true, base: false, perUnit: false, tolerance: false };
    case "PENALTY_POINT":
      return { target: false, base: true, perUnit: true, tolerance: false };
    case "REWARD_POINT":
      return { target: true, base: false, perUnit: true, tolerance: false };
    case "PENALTY_PERCENT":
      return { target: false, base: false, perUnit: true, tolerance: false };
    case "TOLERANCE_LIMIT":
      return { target: false, base: true, perUnit: true, tolerance: true };
    default:
      return { target: false, base: false, perUnit: false, tolerance: false };
  }
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

  const selectedDefinition = useMemo(() => {
    const defId = isEdit ? roleKpi?.kpiId : form.kpiId;
    return definitions.find((d) => d.id === defId);
  }, [isEdit, roleKpi, form.kpiId, definitions]);

  const scoringType = selectedDefinition?.scoringType;
  const fields = fieldsFor(scoringType);

  const availableDefinitions = useMemo(() => {
    if (isEdit) return definitions;
    return definitions.filter((d) => !configuredKpiIds.includes(d.id) && d.isActive);
  }, [definitions, configuredKpiIds, isEdit]);

  useEffect(() => {
    if (open && roleKpi) {
      setForm({
        kpiId: roleKpi.kpiId,
        bobot: String(Math.round(Number(roleKpi.weight) * 100)),
        targetValue: roleKpi.targetValue ? String(Number(roleKpi.targetValue)) : "",
        basePoint: roleKpi.basePoint ? String(Number(roleKpi.basePoint)) : "100",
        pointPerUnit: roleKpi.pointPerUnit ? String(Number(roleKpi.pointPerUnit)) : "",
        toleranceLimit: roleKpi.toleranceLimit ? String(Number(roleKpi.toleranceLimit)) : "",
        toleranceScope: roleKpi.toleranceScope ?? "DAILY",
        maxAchievement: String(Math.round(Number(roleKpi.maxAchievement) * 100)),
        inputSource: roleKpi.inputSource ?? "",
        requiresApproval:
          roleKpi.requiresApproval === null ? "" : roleKpi.requiresApproval ? "YES" : "NO",
        requiresEvidence:
          roleKpi.requiresEvidence === null ? "" : roleKpi.requiresEvidence ? "YES" : "NO",
        isActive: roleKpi.isActive,
      });
    } else if (!open) {
      setForm(empty);
    }
  }, [open, roleKpi]);

  const saveMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const url = isEdit ? `/api/role-kpis/${roleKpi!.id}` : "/api/role-kpis";
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

  const numOrNull = (v: string) => (v.trim() === "" ? null : parseFloat(v));
  const boolOrNull = (v: string) => (v === "" ? null : v === "YES");

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
    // Tanpa angka ini engine tidak bisa menilai apa pun — lebih baik ditolak di
    // sini daripada diam-diam menghasilkan skor 0 tiap bulan.
    if (fields.target && !form.targetValue) {
      toast.error("Target wajib diisi untuk cara penilaian ini");
      return;
    }
    if (fields.perUnit && !form.pointPerUnit) {
      toast.error("Poin/persen per kejadian wajib diisi untuk cara penilaian ini");
      return;
    }
    if (fields.tolerance && !form.toleranceLimit) {
      toast.error("Batas toleransi wajib diisi untuk cara penilaian ini");
      return;
    }

    const params = {
      weight: bobotNum / 100,
      targetValue: fields.target ? numOrNull(form.targetValue) : null,
      basePoint: fields.base ? numOrNull(form.basePoint) : null,
      pointPerUnit: fields.perUnit ? numOrNull(form.pointPerUnit) : null,
      toleranceLimit: fields.tolerance ? numOrNull(form.toleranceLimit) : null,
      toleranceScope: fields.tolerance ? form.toleranceScope : null,
      maxAchievement: (parseFloat(form.maxAchievement) || 120) / 100,
      inputSource: form.inputSource === "" ? null : form.inputSource,
      requiresApproval: boolOrNull(form.requiresApproval),
      requiresEvidence: boolOrNull(form.requiresEvidence),
      isActive: form.isActive,
    };

    saveMutation.mutate(
      isEdit ? params : { companyId, customRoleId, kpiId: form.kpiId, ...params }
    );
  };

  const unitLabel = selectedDefinition?.unit === "CURRENCY" ? "Rp" : "";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger ?? <Button>+ Tambah KPI</Button>}</SheetTrigger>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Atur KPI Jabatan" : "Tambah KPI ke Jabatan Ini"}</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 mt-6 px-1">
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
                      — {SCORING_TYPE_LABELS[d.scoringType] ?? d.scoringType}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!isEdit && availableDefinitions.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Semua KPI aktif sudah dikonfigurasi untuk jabatan ini.
              </p>
            )}
            {selectedDefinition?.description && (
              <p className="text-xs text-muted-foreground border-l-2 border-border pl-2">
                {selectedDefinition.description}
              </p>
            )}
          </div>

          {/* Bobot % + bar langsung */}
          <div className="grid gap-2">
            <FieldLabel tooltip="Kontribusi KPI ini terhadap skor jabatan. Idealnya total seluruh KPI = 100%.">
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
                onChange={(e) => setForm((f) => ({ ...f, bobot: e.target.value }))}
                className="w-28"
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>

            <div className="flex flex-col gap-1">
              <div className="h-2 rounded-full bg-muted overflow-hidden flex">
                <div
                  className="h-full bg-muted-foreground/30 transition-all"
                  style={{ width: `${Math.min(currentTotalPct, 100)}%` }}
                />
                {bobotNum > 0 && (
                  <div
                    className={`h-full transition-all ${barOverflow ? "bg-destructive" : "bg-primary"}`}
                    style={{ width: `${Math.min(bobotNum, Math.max(100 - currentTotalPct, 0))}%` }}
                  />
                )}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  Total setelah disimpan:{" "}
                  <span className={`font-medium ${barOverflow ? "text-destructive" : "text-foreground"}`}>
                    {afterFill.toFixed(0)}%
                  </span>
                </span>
                <span>
                  Sisa:{" "}
                  <span className={`font-medium ${remaining <= 0 ? "text-destructive" : "text-foreground"}`}>
                    {Math.max(remaining, 0).toFixed(0)}%
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* ── Parameter penilaian, mengikuti cara penilaian definisinya ── */}
          {fields.target && (
            <div className="grid gap-1.5">
              <FieldLabel
                tooltip={
                  scoringType === "REWARD_POINT"
                    ? "Total poin yang harus terkumpul sebulan agar KPI ini dianggap 100%."
                    : "Angka yang harus dicapai sebulan. Pencapaian di atas plafon tidak dihitung lebih."
                }
              >
                {scoringType === "REWARD_POINT" ? "Target Poin per Bulan" : `Target per Bulan ${unitLabel}`}
              </FieldLabel>
              <NumberInput
                placeholder={scoringType === "REWARD_POINT" ? "Contoh: 50" : "Contoh: 700000000"}
                value={form.targetValue}
                onValueChange={(val) =>
                  setForm((f) => ({ ...f, targetValue: val === undefined ? "" : String(val) }))
                }
              />
            </div>
          )}

          {fields.base && (
            <div className="grid gap-1.5">
              <FieldLabel tooltip="Poin awal sebelum dikurangi penalti. Standar perusahaan 100 poin.">
                Poin Awal
              </FieldLabel>
              <Input
                type="number"
                min="1"
                placeholder="100"
                value={form.basePoint}
                onChange={(e) => setForm((f) => ({ ...f, basePoint: e.target.value }))}
              />
            </div>
          )}

          {fields.perUnit && (
            <div className="grid gap-1.5">
              <FieldLabel
                tooltip={
                  scoringType === "REWARD_POINT"
                    ? "Poin yang didapat setiap satu kejadian tercatat."
                    : scoringType === "PENALTY_PERCENT"
                      ? "Persen yang hilang setiap satu kejadian tercatat."
                      : "Poin yang hilang setiap satu kejadian tercatat."
                }
              >
                {scoringType === "REWARD_POINT"
                  ? "Poin per Kejadian"
                  : scoringType === "PENALTY_PERCENT"
                    ? "Persen Minus per Kejadian"
                    : "Poin Minus per Kejadian"}
              </FieldLabel>
              <Input
                type="number"
                min="0"
                step="0.5"
                placeholder={scoringType === "PENALTY_PERCENT" ? "Contoh: 5" : "Contoh: 3"}
                value={form.pointPerUnit}
                onChange={(e) => setForm((f) => ({ ...f, pointPerUnit: e.target.value }))}
              />
            </div>
          )}

          {fields.tolerance && (
            <>
              <div className="grid gap-1.5">
                <FieldLabel tooltip="Nilai yang masih dimaklumi. Yang melewatinya baru kena penalti.">
                  Batas Toleransi {unitLabel}
                </FieldLabel>
                <NumberInput
                  placeholder="Contoh: 100000"
                  value={form.toleranceLimit}
                  onValueChange={(val) =>
                    setForm((f) => ({ ...f, toleranceLimit: val === undefined ? "" : String(val) }))
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <FieldLabel tooltip="Batas dihitung per hari, per minggu, atau untuk seluruh bulan.">
                  Cakupan Toleransi
                </FieldLabel>
                <Select
                  value={form.toleranceScope}
                  onValueChange={(v) => setForm((f) => ({ ...f, toleranceScope: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DAILY">Per hari</SelectItem>
                    <SelectItem value="WEEKLY">Per minggu</SelectItem>
                    <SelectItem value="MONTHLY">Per bulan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <div className="grid gap-1.5">
            <FieldLabel tooltip="Plafon pencapaian. 120% berarti kelebihan di atas itu tidak menambah skor.">
              Plafon Pencapaian (%)
            </FieldLabel>
            <Input
              type="number"
              min="100"
              max="300"
              step="10"
              value={form.maxAchievement}
              onChange={(e) => setForm((f) => ({ ...f, maxAchievement: e.target.value }))}
              className="w-28"
            />
          </div>

          {/* ── Kebijakan pengisian khusus jabatan ini ── */}
          <div className="grid gap-3 rounded-lg border p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Kebijakan Pengisian
            </p>

            <div className="grid gap-1.5">
              <FieldLabel tooltip="Kosongkan untuk mengikuti pengaturan pada definisi KPI-nya.">
                Diisi Oleh
              </FieldLabel>
              <Select
                value={form.inputSource || "INHERIT"}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, inputSource: v === "INHERIT" ? "" : v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INHERIT">
                    Ikut definisi
                    {selectedDefinition && (
                      <span className="ml-1 text-muted-foreground">
                        (
                        {INPUT_SOURCE_OPTIONS.find(
                          (o) => o.value === selectedDefinition.defaultInputSource
                        )?.label ?? selectedDefinition.defaultInputSource}
                        )
                      </span>
                    )}
                  </SelectItem>
                  {INPUT_SOURCE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label>Perlu Persetujuan</Label>
              <Select
                value={form.requiresApproval || "INHERIT"}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, requiresApproval: v === "INHERIT" ? "" : v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INHERIT">Ikut definisi</SelectItem>
                  <SelectItem value="YES">Ya, tunggu persetujuan atasan</SelectItem>
                  <SelectItem value="NO">Tidak, langsung dihitung</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label>Wajib Bukti</Label>
              <Select
                value={form.requiresEvidence || "INHERIT"}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, requiresEvidence: v === "INHERIT" ? "" : v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INHERIT">Ikut definisi</SelectItem>
                  <SelectItem value="YES">Ya, wajib lampirkan bukti</SelectItem>
                  <SelectItem value="NO">Tidak wajib</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.isActive}
                onCheckedChange={(checked) =>
                  setForm((f) => ({ ...f, isActive: checked === true }))
                }
              />
              Aktif untuk jabatan ini
            </label>
          </div>

          <Button
            type="submit"
            disabled={saveMutation.isPending || (!isEdit && availableDefinitions.length === 0)}
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
