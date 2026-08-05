"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { CalendarDays, Database, Filter, Scale, ShieldAlert, Sigma } from "lucide-react";

import { AdminFormFooter, AdminFormSidebar } from "@/components/admin/admin-form-sidebar";
import { FormSection, PremiumField, PremiumNativeSelect } from "@/components/admin/premium-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { IconInfoCircle, IconLock, IconTrash } from "@tabler/icons-react";
import type { RuleView } from "@/backend/services/payroll-rule.service";

/* ── Bentuk form ──────────────────────────────────────────────────────────── */

type TierForm = {
  min: string;
  max: string;
  kind: "nominal" | "per_unit" | "formula";
  nominal: string;
  perUnit: string;
  unitField: string;
  formula: string;
  label: string;
  mandatorySaturday: boolean;
  warningLetter: boolean;
};

type GuardForm = {
  if: string;
  aksi: "skip" | "terapkan";
  flag: string;
  /** Hanya dipakai saat aksi = "terapkan". */
  kind: "nominal" | "formula";
  nominal: string;
  formula: string;
  label: string;
  mandatorySaturday: boolean;
  warningLetter: boolean;
};
type ConstForm = { nama: string; nilai: string };
/** `"*"` diketik apa adanya; selain itu daftar dipisah koma. */
type TargetForm = { company: string; branch: string; roles: string };

const emptyTier: TierForm = {
  min: "",
  max: "",
  kind: "nominal",
  nominal: "",
  perUnit: "",
  unitField: "",
  formula: "",
  label: "",
  mandatorySaturday: false,
  warningLetter: false,
};

const emptyGuard: GuardForm = {
  if: "",
  aksi: "skip",
  flag: "",
  kind: "nominal",
  nominal: "",
  formula: "",
  label: "",
  mandatorySaturday: false,
  warningLetter: false,
};

const emptyTarget: TargetForm = { company: "*", branch: "*", roles: "*" };

function targetToForm(t: RuleView["targets"][number]): TargetForm {
  const s = (v: string[] | "*" | undefined) =>
    v === undefined || v === "*" ? "*" : v.join(", ");
  return { company: s(t.company), branch: s(t.branch), roles: s(t.roles) };
}

function formToTarget(t: TargetForm) {
  const parse = (v: string) => {
    const trimmed = v.trim();
    if (trimmed === "" || trimmed === "*") return "*" as const;
    return trimmed
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
  };
  return { company: parse(t.company), branch: parse(t.branch), roles: parse(t.roles) };
}

/**
 * Sanksi non-uang yang menyertai sebuah baris Tabel Nilai atau kondisi.
 *
 * Dipakai di dua tempat dengan bentuk yang sama persis, jadi disatukan di sini.
 * Keduanya TIDAK memengaruhi nominal — ia menyertai band yang cocok, dan
 * tersimpan sebagai kolom tersendiri supaya bisa disaring dan dilaporkan, bukan
 * cuma jadi teks di dalam label yang hilang begitu labelnya disunting.
 */
function SanksiNonUang({
  mandatorySaturday,
  warningLetter,
  onChange,
}: {
  mandatorySaturday: boolean;
  warningLetter: boolean;
  onChange: (p: { mandatorySaturday?: boolean; warningLetter?: boolean }) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-xs font-medium">
        Sanksi non-uang — tidak memengaruhi nominal
      </p>
      <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
        <Label className="text-xs font-normal">Wajib masuk setiap Sabtu</Label>
        <Checkbox
          checked={mandatorySaturday}
          onCheckedChange={(c) => onChange({ mandatorySaturday: c === true })}
        />
      </div>
      <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
        <Label className="text-xs font-normal">Disertai Surat Peringatan</Label>
        <Checkbox
          checked={warningLetter}
          onCheckedChange={(c) => onChange({ warningLetter: c === true })}
        />
      </div>
    </div>
  );
}

const numOrNull = (v: string) => {
  const t = v.trim();
  if (t === "") return null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/** Besok — usulan default `berlaku_dari` untuk versi baru. */
function tomorrowIso() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

/* ── Isi awal form ────────────────────────────────────────────────────────── */

type FormState = {
  ruleKey: string;
  mode: string;
  effectiveFrom: string;
  effectiveTo: string;
  sql: string;
  tierField: string;
  tiers: TierForm[];
  defaultKind: "nominal" | "formula";
  defaultNominal: string;
  defaultFormula: string;
  defaultLabel: string;
  defaultFlag: string;
  guards: GuardForm[];
  constants: ConstForm[];
  targets: TargetForm[];
  excepts: TargetForm[];
  note: string;
  changeNote: string;
};

function initialForm(rule?: RuleView): FormState {
  if (!rule) {
    return {
      ruleKey: "",
      mode: "AGREGAT",
      effectiveFrom: tomorrowIso(),
      effectiveTo: "",
      sql: "",
      tierField: "",
      tiers: [{ ...emptyTier }],
      defaultKind: "nominal",
      defaultNominal: "0",
      defaultFormula: "",
      defaultLabel: "",
      defaultFlag: "butuh_review",
      guards: [],
      constants: [],
      targets: [{ ...emptyTarget }],
      excepts: [],
      note: "",
      changeNote: "",
    };
  }

  return {
    ruleKey: rule.id,
    mode: rule.mode === "agregat" ? "AGREGAT" : "PER_BARIS",
    // Versi baru mulai besok, bukan menimpa tanggal versi berjalan — masa
    // berlaku dua versi tidak boleh beririsan.
    effectiveFrom: tomorrowIso(),
    effectiveTo: rule.berlakuSampai ?? "",
    sql: rule.sql,
    tierField: rule.tierField,
    tiers: rule.tiers.map((t) => ({
      min: t.min === null ? "" : String(t.min),
      max: t.max === null ? "" : String(t.max),
      kind: t.kind,
      nominal: t.nominal === null ? "" : String(t.nominal),
      perUnit: t.perUnit === null ? "" : String(t.perUnit),
      unitField: t.unitField ?? "",
      formula: t.formula ?? "",
      label: t.label,
      mandatorySaturday: t.mandatorySaturday,
      warningLetter: t.warningLetter,
    })),
    defaultKind: rule.defaults.formula !== undefined ? "formula" : "nominal",
    defaultNominal: rule.defaults.nominal === undefined ? "" : String(rule.defaults.nominal),
    defaultFormula: rule.defaults.formula ?? "",
    defaultLabel: rule.defaults.label ?? "",
    defaultFlag: rule.defaults.flag ?? "",
    guards: rule.guards.map((g) => ({
      if: g.if,
      aksi: g.aksi === "terapkan" ? ("terapkan" as const) : ("skip" as const),
      flag: g.flag,
      kind: g.formula !== undefined ? ("formula" as const) : ("nominal" as const),
      nominal: g.nominal === undefined ? "" : String(g.nominal),
      formula: g.formula ?? "",
      label: g.label ?? "",
      mandatorySaturday: g.mandatory_saturday ?? false,
      warningLetter: g.warning_letter ?? false,
    })),
    constants: rule.konstanta.map((k) => ({ nama: k.nama, nilai: String(k.nilai) })),
    targets: rule.targets.length ? rule.targets.map(targetToForm) : [{ ...emptyTarget }],
    excepts: rule.excepts.map(targetToForm),
    note: rule.catatan ?? "",
    // Alasan perubahan selalu kosong: ia menjelaskan versi YANG SEDANG DIBUAT,
    // bukan mewarisi alasan versi sebelumnya.
    changeNote: "",
  };
}

/* ── Komponen ─────────────────────────────────────────────────────────────── */

interface Props {
  /** Kosong = membuat rule baru. */
  rule?: RuleView;
  /** Pemegang capability `payroll.rules.sql`. */
  canEditSql: boolean;
  trigger: React.ReactNode;
}

export function PayrollRuleSheet({ rule, canEditSql, trigger }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const isEdit = Boolean(rule);

  const [form, setForm] = useState<FormState>(() => initialForm(rule));

  // Form diisi ulang saat sheet dibuka, memakai pola "menyesuaikan state ketika
  // props berubah" — bukan useEffect. Efek untuk ini menyebabkan satu render
  // ekstra dengan isi form yang basi, dan itu terlihat sebagai kedipan pada
  // form sepanjang ini.
  const sessionKey = open ? `${rule?.rowId ?? "baru"}:${rule?.versi ?? 0}` : "tertutup";
  const [lastSession, setLastSession] = useState(sessionKey);
  if (sessionKey !== lastSession) {
    setLastSession(sessionKey);
    setForm(initialForm(rule));
  }

  const patch = (p: Partial<FormState>) => setForm((f) => ({ ...f, ...p }));

  const {
    ruleKey,
    mode,
    effectiveFrom,
    effectiveTo,
    sql,
    tierField,
    tiers,
    defaultKind,
    defaultNominal,
    defaultFormula,
    defaultLabel,
    defaultFlag,
    guards,
    constants,
    targets,
    excepts,
    note,
    changeNote,
  } = form;

  // Setter per-field di atas satu objek state. Bentuknya sengaja dibuat sama
  // seperti `useState` biasa supaya bagian JSX di bawah tetap terbaca.
  const setRuleKey = (v: string) => patch({ ruleKey: v });
  const setMode = (v: string) => patch({ mode: v });
  const setEffectiveFrom = (v: string) => patch({ effectiveFrom: v });
  const setEffectiveTo = (v: string) => patch({ effectiveTo: v });
  const setSql = (v: string) => patch({ sql: v });
  const setTierField = (v: string) => patch({ tierField: v });
  const setTiers = (v: TierForm[]) => patch({ tiers: v });
  const setDefaultKind = (v: string) => patch({ defaultKind: v as FormState["defaultKind"] });
  const setDefaultNominal = (v: string) => patch({ defaultNominal: v });
  const setDefaultFormula = (v: string) => patch({ defaultFormula: v });
  const setDefaultLabel = (v: string) => patch({ defaultLabel: v });
  const setDefaultFlag = (v: string) => patch({ defaultFlag: v });
  const setGuards = (v: GuardForm[]) => patch({ guards: v });
  const setConstants = (v: ConstForm[]) => patch({ constants: v });
  const setTargets = (v: TargetForm[]) => patch({ targets: v });
  const setExcepts = (v: TargetForm[]) => patch({ excepts: v });
  const setNote = (v: string) => patch({ note: v });
  const setChangeNote = (v: string) => patch({ changeNote: v });

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        ruleKey: ruleKey.trim(),
        effectiveFrom,
        effectiveTo: effectiveTo || null,
        mode,
        sql: sql.trim(),
        tierField: tierField.trim(),
        constants: constants.length
          ? Object.fromEntries(
              constants
                .filter((c) => c.nama.trim())
                .map((c) => [c.nama.trim(), Number(c.nilai) || 0])
            )
          : null,
        guards: guards.length
          ? guards
              .filter((g) => g.if.trim())
              .map((g) => ({
                if: g.if.trim(),
                aksi: g.aksi,
                flag: g.flag.trim(),
                ...(g.aksi === "terapkan"
                  ? {
                      label: g.label.trim(),
                      ...(g.kind === "formula"
                        ? { formula: g.formula.trim() }
                        : { nominal: Number(g.nominal) || 0 }),
                      // Hanya dikirim kalau menyala: validator menolak sanksi
                      // non-uang pada aksi "skip", dan mengirim `false` di sana
                      // tetap terbaca sebagai field yang tidak pada tempatnya.
                      ...(g.mandatorySaturday ? { mandatory_saturday: true } : {}),
                      ...(g.warningLetter ? { warning_letter: true } : {}),
                    }
                  : {}),
              }))
          : null,
        defaults: {
          // Tepat satu dari nominal/formula — mengisi keduanya ditolak validator.
          ...(defaultKind === "formula"
            ? { formula: defaultFormula.trim() }
            : defaultNominal.trim() === ""
              ? {}
              : { nominal: Number(defaultNominal) }),
          ...(defaultLabel.trim() ? { label: defaultLabel.trim() } : {}),
          ...(defaultFlag.trim() ? { flag: defaultFlag.trim() } : {}),
        },
        targets: targets.map(formToTarget),
        excepts: excepts.length ? excepts.map(formToTarget) : null,
        note: note.trim() || null,
        changeNote: changeNote.trim() || null,
        tiers: tiers.map((t) => ({
          min: numOrNull(t.min),
          max: numOrNull(t.max),
          nominal: t.kind === "nominal" ? numOrNull(t.nominal) : null,
          perUnit: t.kind === "per_unit" ? numOrNull(t.perUnit) : null,
          unitField: t.kind === "per_unit" ? t.unitField.trim() || null : null,
          formula: t.kind === "formula" ? t.formula.trim() || null : null,
          label: t.label.trim(),
          mandatorySaturday: t.mandatorySaturday,
          warningLetter: t.warningLetter,
        })),
      };

      const res = await fetch("/api/payroll-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Gagal menyimpan rule");
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message ?? "Rule disimpan");
      setOpen(false);
      router.refresh();
    },
    // Pesan validator bisa memuat beberapa baris sekaligus — jangan dipotong.
    onError: (err: Error) => toast.error(err.message, { duration: 12_000 }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleKey.trim()) return toast.error("Kode rule wajib diisi");
    if (!tierField.trim()) return toast.error("Kolom pembanding wajib diisi");
    if (tiers.some((t) => !t.label.trim())) {
      return toast.error(
        "Setiap baris Tabel Nilai wajib punya label — itu alasan yang tampil di slip gaji"
      );
    }
    save.mutate();
  };

  const sqlLocked = isEdit && !canEditSql;

  return (
    <AdminFormSidebar
      open={open}
      onOpenChange={setOpen}
      title={isEdit ? `Ubah Rule — ${rule?.id}` : "Rule Reward / Denda Baru"}
      description={
        isEdit
          ? `Menyimpan akan membuat versi ${(rule?.versi ?? 0) + 1}. Versi ${rule?.versi} tidak diubah — slip yang sudah memakainya tetap bisa menjelaskan angkanya.`
          : "Aturan yang menentukan bonus, denda, atau potongan di slip gaji."
      }
      icon={<Scale className="h-5 w-5" />}
      onSubmit={handleSubmit}
      trigger={trigger}
      footer={
        <AdminFormFooter
          onCancel={() => setOpen(false)}
          loading={save.isPending}
          submitLabel={isEdit ? `Simpan sebagai v${(rule?.versi ?? 0) + 1}` : "Buat Rule"}
        />
      }
    >
      <FormSection title="Identitas" icon={<Scale className="h-3.5 w-3.5" />}>
        <PremiumField
          label="Kode Rule *"
          placeholder="mis. denda_keterlambatan"
          value={ruleKey}
          disabled={isEdit}
          onChange={(e) => setRuleKey(e.target.value)}
        />
        {isEdit && (
          <p className="text-muted-foreground text-xs">
            Kode tidak bisa diubah — slip gaji yang sudah tersimpan merujuk kode ini.
          </p>
        )}

        <p className="text-muted-foreground text-xs">
          Rule tidak punya jenis. Yang menentukan menambah atau mengurangi gaji adalah
          tanda nominal pada kondisi yang cocok: <strong>positif menambah</strong>,{" "}
          <strong>negatif mengurangi</strong>. Satu rule karena itu boleh memberi bonus
          pada skor tinggi sekaligus memotong pada skor rendah.
        </p>

        <PremiumNativeSelect
          label="Mode *"
          value={mode}
          onValueChange={setMode}
          options={[
            { value: "AGREGAT", label: "Agregat — satu baris, dinilai sekali" },
            { value: "PER_BARIS", label: "Per kejadian — banyak baris, dijumlahkan" },
          ]}
        />
      </FormSection>

      <FormSection title="Masa Berlaku" icon={<CalendarDays className="h-3.5 w-3.5" />}>
        <PremiumField
          label="Mulai Berlaku *"
          type="date"
          value={effectiveFrom}
          onChange={(e) => setEffectiveFrom(e.target.value)}
        />
        <PremiumField
          label="Berlaku Sampai"
          type="date"
          value={effectiveTo}
          onChange={(e) => setEffectiveTo(e.target.value)}
        />
        <p className="text-muted-foreground text-xs">
          Kosongkan kalau masih berlaku. Saat versi baru disimpan, masa berlaku versi
          sebelumnya ditutup otomatis sehari sebelum tanggal mulai di atas.
        </p>
      </FormSection>

      <FormSection title="Sumber Data" icon={<Database className="h-3.5 w-3.5" />}>
        {sqlLocked ? (
          <Alert>
            <IconLock className="size-4" />
            <AlertDescription>
              Query dikunci — mengubahnya butuh izin <strong>Ubah SQL Rule Gaji</strong>.
              Query versi berjalan tetap dipakai apa adanya untuk versi baru.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <IconInfoCircle className="size-4" />
            <AlertDescription>
              Query hanya boleh membaca view <code>hv_*</code>, wajib memfilter periode
              (<code>:periode_awal</code>/<code>:periode_akhir</code> atau{" "}
              <code>:periode_bulan</code> + <code>:periode_tahun</code>), dan wajib
              memberi alias pada tiap kolom hasil.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-1.5">
          <Label className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            Query SQL *
          </Label>
          <Textarea
            rows={8}
            className="font-mono text-xs"
            disabled={sqlLocked}
            placeholder="SELECT ... FROM hv_attendance a WHERE a.user_id = :employee_id AND a.date BETWEEN :periode_awal AND :periode_akhir"
            value={sql}
            onChange={(e) => setSql(e.target.value)}
          />
        </div>

        <PremiumField
          label="Kolom Pembanding *"
          placeholder="mis. hari_hadir"
          value={tierField}
          onChange={(e) => setTierField(e.target.value)}
        />
        <p className="text-muted-foreground text-xs">
          Nama alias kolom hasil query yang dipakai mencocokkan Tabel Nilai di bawah.
        </p>
      </FormSection>

      <FormSection title="Tabel Nilai" icon={<Sigma className="h-3.5 w-3.5" />}>
        <p className="text-muted-foreground text-xs">
          Pakai <strong>Tabel Nilai</strong> kalau bandnya berdasarkan satu angka; pakai{" "}
          <strong>Kondisi</strong> di bawah kalau syaratnya menggabungkan beberapa hal.
        </p>
        <p className="text-muted-foreground text-xs">
          Rentang wajib menyeluruh dan tidak boleh tumpang tindih — validator menolak
          rule yang punya celah. Batas atas & bawah keduanya inklusif; kosongkan untuk
          tak terbatas.
        </p>

        {tiers.map((t, i) => (
          <div key={i} className="space-y-3 rounded-lg border px-3 py-3">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs font-medium">Baris {i + 1}</span>
              {tiers.length > 1 && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="text-destructive hover:text-destructive size-7"
                  onClick={() => setTiers(tiers.filter((_, x) => x !== i))}
                >
                  <IconTrash className="size-4" />
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <PremiumField
                label="Min"
                placeholder="—"
                value={t.min}
                onChange={(e) =>
                  setTiers(tiers.map((x, k) => (k === i ? { ...x, min: e.target.value } : x)))
                }
              />
              <PremiumField
                label="Max"
                placeholder="—"
                value={t.max}
                onChange={(e) =>
                  setTiers(tiers.map((x, k) => (k === i ? { ...x, max: e.target.value } : x)))
                }
              />
            </div>

            <PremiumNativeSelect
              label="Cara Hitung"
              value={t.kind}
              onValueChange={(v) =>
                setTiers(tiers.map((x, k) => (k === i ? { ...x, kind: v as TierForm["kind"] } : x)))
              }
              options={[
                { value: "nominal", label: "Nominal tetap" },
                { value: "per_unit", label: "Per satuan (mode per kejadian)" },
                { value: "formula", label: "Formula" },
              ]}
            />

            {t.kind === "nominal" && (
              <div className="space-y-1.5">
                <PremiumField
                  label="Nominal (IDR)"
                  placeholder="500000 menambah · -300000 memotong"
                  value={t.nominal}
                  onChange={(e) =>
                    setTiers(tiers.map((x, k) => (k === i ? { ...x, nominal: e.target.value } : x)))
                  }
                />
                <p className="text-muted-foreground text-xs">
                  Tandanya yang menentukan arah: <strong>positif menambah</strong> gaji,{" "}
                  <strong>negatif memotong</strong>. Isi <code>0</code> untuk band aman yang
                  tetap ingin dijelaskan di slip.
                </p>
              </div>
            )}

            {t.kind === "per_unit" && (
              <div className="grid grid-cols-2 gap-2">
                <PremiumField
                  label="Per Satuan (IDR)"
                  placeholder="-1000 memotong per satuan"
                  value={t.perUnit}
                  onChange={(e) =>
                    setTiers(tiers.map((x, k) => (k === i ? { ...x, perUnit: e.target.value } : x)))
                  }
                />
                <PremiumField
                  label="Kolom Satuan"
                  placeholder="menit_telat"
                  value={t.unitField}
                  onChange={(e) =>
                    setTiers(
                      tiers.map((x, k) => (k === i ? { ...x, unitField: e.target.value } : x))
                    )
                  }
                />
              </div>
            )}

            {t.kind === "per_unit" && mode !== "PER_BARIS" && (
              <p className="text-destructive text-xs">
                “Per satuan” hanya boleh dipakai pada mode <strong>Per kejadian</strong>.
                Rule ini bermode Agregat — validator akan menolaknya saat disimpan.
              </p>
            )}

            {t.kind === "formula" && (
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  Formula
                </Label>
                <Textarea
                  rows={2}
                  className="font-mono text-xs"
                  placeholder="min(hari_hadir, hari_kerja_standar) * (karyawan.uang_makan / hari_kerja_standar)"
                  value={t.formula}
                  onChange={(e) =>
                    setTiers(tiers.map((x, k) => (k === i ? { ...x, formula: e.target.value } : x)))
                  }
                />
                <p className="text-muted-foreground text-xs">
                  Operator + − * / % dan fungsi min, max, round, floor, ceil, abs. Boleh
                  merujuk kolom query, konstanta, <code>karyawan.*</code>, dan{" "}
                  <code>periode.*</code>.
                </p>
              </div>
            )}

            <PremiumField
              label="Label *"
              placeholder="Alasan yang tampil di slip gaji"
              value={t.label}
              onChange={(e) =>
                setTiers(tiers.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)))
              }
            />

            <SanksiNonUang
              mandatorySaturday={t.mandatorySaturday}
              warningLetter={t.warningLetter}
              onChange={(p) => setTiers(tiers.map((x, k) => (k === i ? { ...x, ...p } : x)))}
            />
          </div>
        ))}

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setTiers([...tiers, { ...emptyTier }])}
        >
          + Tambah Baris
        </Button>

        <div className="mt-4 space-y-3 rounded-lg border border-dashed px-3 py-3">
          <p className="text-muted-foreground text-xs font-medium">
            Kalau tidak ada baris yang cocok
          </p>
          <PremiumNativeSelect
            label="Cara Hitung"
            value={defaultKind}
            onValueChange={setDefaultKind}
            options={[
              { value: "nominal", label: "Nominal tetap" },
              { value: "formula", label: "Formula" },
            ]}
          />

          {defaultKind === "nominal" ? (
            <PremiumField
              label="Nominal Default (IDR)"
              placeholder="0"
              value={defaultNominal}
              onChange={(e) => setDefaultNominal(e.target.value)}
            />
          ) : (
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                Formula Default
              </Label>
              <Textarea
                rows={2}
                className="font-mono text-xs"
                placeholder="karyawan.gaji_pokok * 0.05"
                value={defaultFormula}
                onChange={(e) => setDefaultFormula(e.target.value)}
              />
            </div>
          )}
          <PremiumField
            label="Label Default"
            placeholder="mis. Belum masuk band berbonus"
            value={defaultLabel}
            onChange={(e) => setDefaultLabel(e.target.value)}
          />
          <PremiumField
            label="Flag"
            placeholder="butuh_review"
            value={defaultFlag}
            onChange={(e) => setDefaultFlag(e.target.value)}
          />
          <p className="text-muted-foreground text-xs">
            Flag menandai slip supaya masuk antrian review manusia. Biarkan{" "}
            <code>butuh_review</code> kecuali kamu yakin jatuh ke default itu normal.
          </p>
        </div>
      </FormSection>

      <FormSection title="Kondisi" icon={<ShieldAlert className="h-3.5 w-3.5" />}>
        <p className="text-muted-foreground text-xs">
          Dinilai <strong>sebelum</strong> Tabel Nilai, berurutan dari atas
          — yang pertama cocok menang dan sisanya tidak dilihat lagi. Dipakai untuk
          syarat yang tidak muat sebagai rentang pada satu kolom.
        </p>
        <p className="text-muted-foreground text-xs">
          <strong>Lewati</strong> membatalkan rule tanpa uang, alasannya tetap tercatat
          di slip. <strong>Terapkan</strong> langsung memakai nominalnya dan Tabel Nilai
          tidak dinilai sama sekali — tandanya menentukan arah, sama seperti di sana.
        </p>
        <p className="text-muted-foreground text-xs">
          Kondisi boleh digabung dengan <code>and</code> dan <code>or</code>, mis.{" "}
          <code>berkontrak == 0 and skor_persen &gt;= 86</code>. <code>and</code>{" "}
          mengikat lebih erat daripada <code>or</code> — pakai kurung kalau maksudnya
          lain.
        </p>

        {guards.map((g, i) => {
          const setGuard = (p: Partial<GuardForm>) =>
            setGuards(guards.map((x, k) => (k === i ? { ...x, ...p } : x)));

          return (
            <div key={i} className="grid grid-cols-[1fr_auto] items-start gap-2">
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <PremiumField
                    label="Kondisi"
                    placeholder="hari_tercatat == 0"
                    className="font-mono text-xs"
                    value={g.if}
                    onChange={(e) => setGuard({ if: e.target.value })}
                  />
                  <PremiumField
                    label="Flag"
                    placeholder="data_kosong"
                    value={g.flag}
                    onChange={(e) => setGuard({ flag: e.target.value })}
                  />
                </div>

                <PremiumNativeSelect
                  label="Aksi"
                  value={g.aksi}
                  onValueChange={(v) => setGuard({ aksi: v as GuardForm["aksi"] })}
                  options={[
                    { value: "skip", label: "Lewati — batalkan rule, tanpa uang" },
                    { value: "terapkan", label: "Terapkan — pakai nominal ini, abaikan Tabel Nilai" },
                  ]}
                />

                {g.aksi === "terapkan" && (
                  <div className="space-y-2">
                    <PremiumField
                      label="Alasan di slip *"
                      placeholder="mis. Bonus penuh — target tercapai sebelum akhir bulan"
                      value={g.label}
                      onChange={(e) => setGuard({ label: e.target.value })}
                    />
                    <PremiumNativeSelect
                      label="Nilai dari"
                      value={g.kind}
                      onValueChange={(v) => setGuard({ kind: v as GuardForm["kind"] })}
                      options={[
                        { value: "nominal", label: "Nominal tetap" },
                        { value: "formula", label: "Formula" },
                      ]}
                    />
                    {g.kind === "nominal" ? (
                      <PremiumField
                        label="Nominal (IDR)"
                        placeholder="500000 menambah · -300000 memotong · 0 tanpa nominal"
                        value={g.nominal}
                        onChange={(e) => setGuard({ nominal: e.target.value })}
                      />
                    ) : (
                      <PremiumField
                        label="Formula"
                        className="font-mono text-xs"
                        placeholder="karyawan.gaji_pokok * 0.1"
                        value={g.formula}
                        onChange={(e) => setGuard({ formula: e.target.value })}
                      />
                    )}

                    <SanksiNonUang
                      mandatorySaturday={g.mandatorySaturday}
                      warningLetter={g.warningLetter}
                      onChange={setGuard}
                    />
                  </div>
                )}
              </div>

              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="text-destructive hover:text-destructive mt-6"
                onClick={() => setGuards(guards.filter((_, x) => x !== i))}
              >
                <IconTrash className="size-4" />
              </Button>
            </div>
          );
        })}

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setGuards([...guards, { ...emptyGuard }])}
        >
          + Tambah Kondisi
        </Button>
      </FormSection>

      <FormSection title="Konstanta" icon={<Sigma className="h-3.5 w-3.5" />}>
        <p className="text-muted-foreground text-xs">
          Angka bernama yang dipakai formula. Menaruh 24 di sini dengan nama{" "}
          <code>hari_kerja_standar</code> jauh lebih terbaca daripada angka 24 di tengah
          rumus.
        </p>

        {constants.map((c, i) => (
          <div key={i} className="grid grid-cols-[1fr_auto] items-end gap-2">
            <div className="grid grid-cols-2 gap-2">
              <PremiumField
                label="Nama"
                placeholder="hari_kerja_standar"
                value={c.nama}
                onChange={(e) =>
                  setConstants(
                    constants.map((x, k) => (k === i ? { ...x, nama: e.target.value } : x))
                  )
                }
              />
              <PremiumField
                label="Nilai"
                placeholder="24"
                value={c.nilai}
                onChange={(e) =>
                  setConstants(
                    constants.map((x, k) => (k === i ? { ...x, nilai: e.target.value } : x))
                  )
                }
              />
            </div>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="text-destructive hover:text-destructive mb-0.5"
              onClick={() => setConstants(constants.filter((_, x) => x !== i))}
            >
              <IconTrash className="size-4" />
            </Button>
          </div>
        ))}

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setConstants([...constants, { nama: "", nilai: "" }])}
        >
          + Tambah Konstanta
        </Button>
      </FormSection>

      <FormSection title="Sasaran" icon={<Filter className="h-3.5 w-3.5" />}>
        <p className="text-muted-foreground text-xs">
          Isi <code>*</code> untuk semua, atau daftar dipisah koma (kode PT, nama cabang,
          nama jabatan). Antar grup bersifat ATAU; di dalam satu grup semuanya harus cocok.
        </p>

        {targets.map((t, i) => (
          <TargetRow
            key={i}
            value={t}
            onChange={(v) => setTargets(targets.map((x, k) => (k === i ? v : x)))}
            onRemove={targets.length > 1 ? () => setTargets(targets.filter((_, x) => x !== i)) : undefined}
          />
        ))}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setTargets([...targets, { ...emptyTarget }])}
        >
          + Tambah Grup Sasaran
        </Button>

        {excepts.length > 0 && (
          <>
            <p className="text-muted-foreground mt-4 text-xs font-medium">
              Pengecualian — selalu menang atas sasaran di atas
            </p>
            {excepts.map((t, i) => (
              <TargetRow
                key={i}
                value={t}
                onChange={(v) => setExcepts(excepts.map((x, k) => (k === i ? v : x)))}
                onRemove={() => setExcepts(excepts.filter((_, x) => x !== i))}
              />
            ))}
          </>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setExcepts([...excepts, { company: "*", branch: "*", roles: "" }])}
        >
          + Tambah Pengecualian
        </Button>
      </FormSection>

      <FormSection title="Catatan">
        <div className="space-y-1.5">
          <Label className="text-xs">Catatan Rule</Label>
          <Textarea
            rows={3}
            placeholder="Dasar kebijakannya, sumber sheet, hal yang perlu diketahui orang berikutnya."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Alasan Perubahan {isEdit && "*"}</Label>
          <Textarea
            rows={2}
            placeholder="mis. Nominal dinaikkan sesuai keputusan rapat 3 Agustus."
            value={changeNote}
            onChange={(e) => setChangeNote(e.target.value)}
          />
          <p className="text-muted-foreground text-xs">
            Tersimpan bersama versi ini. Inilah yang menggantikan pesan commit sejak rule
            pindah dari file ke database.
          </p>
        </div>
      </FormSection>
    </AdminFormSidebar>
  );
}

function TargetRow({
  value,
  onChange,
  onRemove,
}: {
  value: TargetForm;
  onChange: (v: TargetForm) => void;
  onRemove?: () => void;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-end gap-2">
      <div className="grid grid-cols-3 gap-2">
        <PremiumField
          label="PT"
          placeholder="*"
          value={value.company}
          onChange={(e) => onChange({ ...value, company: e.target.value })}
        />
        <PremiumField
          label="Cabang"
          placeholder="*"
          value={value.branch}
          onChange={(e) => onChange({ ...value, branch: e.target.value })}
        />
        <PremiumField
          label="Jabatan"
          placeholder="*"
          value={value.roles}
          onChange={(e) => onChange({ ...value, roles: e.target.value })}
        />
      </div>
      {onRemove && (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="text-destructive hover:text-destructive mb-0.5"
          onClick={onRemove}
        >
          <IconTrash className="size-4" />
        </Button>
      )}
    </div>
  );
}
