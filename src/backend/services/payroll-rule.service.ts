// ═══════════════════════════════════════════════════════════════════════════
// Baca & tulis rule reward/denda.
//
// Menyimpan rule TIDAK PERNAH `UPDATE`. Setiap penyimpanan membuat VERSI BARU
// dan menutup masa berlaku versi sebelumnya. Slip yang sudah dibayar merujuk
// `ruleKey@version`; kalau baris lama ditimpa, slip bulan lampau kehilangan
// penjelasan angkanya — persis yang harus dicegah.
//
// Dua izin yang berbeda bertemu di sini:
//   • payroll.rules      → tier, nominal, sasaran, masa berlaku
//   • payroll.rules.sql  → query pengambil data
// Pemanggil tanpa yang kedua tidak bisa mengubah SQL sama sekali; nilai lama
// dipertahankan paksa di service, bukan sekadar disembunyikan di UI.
// ═══════════════════════════════════════════════════════════════════════════

import type { Prisma } from "@src/generated/prisma/client";

import prisma from "@/lib/prisma";
import { ForbiddenError, ValidationError } from "@/backend/errors/app-error";
import { tierLabelOf } from "@/backend/payroll-rules/engine";
import { loadRuleSet, toIsoDate } from "@/backend/payroll-rules/loader";
import { hasSigningKey, signRule } from "@/backend/payroll-rules/signature";
import { validateRule } from "@/backend/payroll-rules/validate";
import type {
  PayrollRule,
  RuleGuard,
  RuleTarget,
  RuleTier,
} from "@/backend/payroll-rules/types";
import { isViewOnlyConfigured } from "@/lib/db-view-only";

// ── Bentuk untuk UI ────────────────────────────────────────────────────────

export interface RuleTierView {
  range: string;
  rangeLabel: string;
  label: string;
  kind: "nominal" | "per_unit" | "formula";
  min: number | null;
  max: number | null;
  nominal: number | null;
  perUnit: number | null;
  unitField: string | null;
  formula: string | null;
  /** Sanksi non-uang yang menyertai tier — tidak memengaruhi nominal. */
  mandatorySaturday: boolean;
  warningLetter: boolean;
}

export interface RuleView {
  /** Primary key baris — dipakai UI saat menyunting. */
  rowId: string;
  id: string;
  versi: number;
  file: string;
  mode: "agregat" | "per_baris";
  berlakuDari: string;
  berlakuSampai: string | null;
  aktif: boolean;
  /** Versi terbaru untuk `ruleKey` ini — hanya ini yang boleh disunting. */
  isLatest: boolean;
  tierField: string;
  tiers: RuleTierView[];
  defaultLabel: string;
  defaultFlag: string | null;
  defaults: { nominal?: number; formula?: string; label?: string; flag?: string };
  guards: RuleGuard[];
  konstanta: { nama: string; nilai: number }[];
  targets: RuleTarget[];
  excepts: RuleTarget[];
  sasaran: string[];
  kecuali: string[];
  sql: string;
  catatan: string | null;
  errors: string[];
  warnings: string[];
}

export interface RuleSetView {
  rules: RuleView[];
  broken: { file: string; errors: string[] }[];
  hash: string;
  /** Peringatan setup — ditampilkan di halaman, bukan disembunyikan di log. */
  setup: { signingKey: boolean; viewOnlyConnection: boolean };
}

function humanRange(tier: RuleTier): string {
  const { min, max } = tier;
  if (typeof min === "number" && typeof max === "number") {
    return min === max ? `tepat ${min}` : `${min} – ${max}`;
  }
  if (typeof min === "number") return `${min} ke atas`;
  if (typeof max === "number") return `${max} ke bawah`;
  return "berapa pun";
}

function describeTarget(t: RuleTarget): string {
  const part = (label: string, v: string[] | "*" | undefined) =>
    v === undefined || v === "*" ? `${label}: semua` : `${label}: ${v.join(", ")}`;
  return [part("PT", t.company), part("Cabang", t.branch), part("Jabatan", t.roles)].join(" · ");
}

export async function listRulesForUi(today = new Date()): Promise<RuleSetView> {
  const set = await loadRuleSet();
  const iso = toIsoDate(today);

  // Hanya versi tertinggi tiap ruleKey yang boleh disunting — menyunting versi
  // lampau berarti mengubah dasar slip yang sudah dibayar.
  const latestVersion = new Map<string, number>();
  for (const r of set.rules) {
    latestVersion.set(r.rule.id, Math.max(latestVersion.get(r.rule.id) ?? 0, r.rule.versi));
  }

  const rules: RuleView[] = set.rules.map((loaded) => {
    const r = loaded.rule;
    const berlaku = r.berlaku_dari <= iso && (!r.berlaku_sampai || r.berlaku_sampai >= iso);

    return {
      rowId: loaded.rowId,
      id: r.id,
      versi: r.versi,
      file: loaded.file,
      mode: r.mode,
      berlakuDari: r.berlaku_dari,
      berlakuSampai: r.berlaku_sampai ?? null,
      aktif: berlaku && loaded.errors.length === 0,
      isLatest: latestVersion.get(r.id) === r.versi,
      tierField: r.tier_field,
      tiers: (r.tiers ?? []).map((t) => ({
        range: tierLabelOf(t),
        rangeLabel: humanRange(t),
        label: t.label,
        kind:
          t.per_unit !== undefined ? "per_unit" : t.formula !== undefined ? "formula" : "nominal",
        min: t.min ?? null,
        max: t.max ?? null,
        nominal: t.nominal ?? null,
        perUnit: t.per_unit ?? null,
        unitField: t.unit_field ?? null,
        formula: t.formula ?? null,
        mandatorySaturday: t.mandatory_saturday ?? false,
        warningLetter: t.warning_letter ?? false,
      })),
      defaultLabel:
        r.default?.label ??
        (r.default?.formula
          ? `formula: ${r.default.formula}`
          : `Rp ${new Intl.NumberFormat("id-ID").format(r.default?.nominal ?? 0)}`),
      defaultFlag: r.default?.flag ?? null,
      defaults: r.default ?? { nominal: 0 },
      guards: r.guard ?? [],
      konstanta: Object.entries(r.konstanta ?? {}).map(([nama, nilai]) => ({ nama, nilai })),
      targets: r.for ?? [],
      excepts: r.except ?? [],
      sasaran: (r.for ?? []).map(describeTarget),
      kecuali: (r.except ?? []).map(describeTarget),
      sql: r.query?.sql ?? "",
      catatan: r.catatan ?? null,
      errors: loaded.errors,
      warnings: loaded.warnings,
    };
  });

  // Rule tidak lagi punya tipe untuk dikelompokkan, jadi urutannya menurut
  // kode rule — dan versi terbaru sebuah rule selalu berdekatan dengan
  // pendahulunya.
  rules.sort((a, b) => a.id.localeCompare(b.id) || a.versi - b.versi);

  return {
    rules,
    broken: set.broken.map((b) => ({ file: b.file, errors: b.errors })),
    hash: set.hash,
    setup: { signingKey: hasSigningKey(), viewOnlyConnection: isViewOnlyConfigured() },
  };
}

// ── Menyimpan ──────────────────────────────────────────────────────────────

export interface RuleTierInput {
  min: number | null;
  max: number | null;
  nominal: number | null;
  perUnit: number | null;
  unitField: string | null;
  formula: string | null;
  label: string;
  mandatorySaturday?: boolean;
  warningLetter?: boolean;
}

export interface RuleInput {
  ruleKey: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  mode: "AGREGAT" | "PER_BARIS";
  sql: string;
  tierField: string;
  constants: Record<string, number> | null;
  guards: RuleGuard[] | null;
  defaults: { nominal?: number; formula?: string; label?: string; flag?: string };
  targets: RuleTarget[];
  excepts: RuleTarget[] | null;
  note: string | null;
  changeNote: string | null;
  tiers: RuleTierInput[];
}

/** Bentuk spesifikasi dari input UI — supaya validator yang sama bisa dipakai. */
function toSpecRule(input: RuleInput, version: number): PayrollRule {
  return {
    id: input.ruleKey,
    versi: version,
    berlaku_dari: input.effectiveFrom,
    berlaku_sampai: input.effectiveTo,
    mode: input.mode === "AGREGAT" ? "agregat" : "per_baris",
    query: { sql: input.sql, expect: input.mode === "AGREGAT" ? "one_row" : "many_rows" },
    konstanta: input.constants ?? undefined,
    guard: input.guards ?? undefined,
    tier_field: input.tierField,
    tiers: input.tiers.map((t) => ({
      min: t.min ?? undefined,
      max: t.max ?? undefined,
      nominal: t.nominal ?? undefined,
      per_unit: t.perUnit ?? undefined,
      unit_field: t.unitField ?? undefined,
      formula: t.formula ?? undefined,
      label: t.label,
      mandatory_saturday: t.mandatorySaturday ?? false,
      warning_letter: t.warningLetter ?? false,
    })),
    default: input.defaults,
    for: input.targets,
    except: input.excepts ?? undefined,
    catatan: input.note ?? undefined,
  };
}

/** Sehari sebelum tanggal ISO — dipakai menutup masa berlaku versi lama. */
function dayBefore(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function utcDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export interface SaveContext {
  userId: string | null;
  /** Pemegang capability `payroll.rules.sql`. */
  canEditSql: boolean;
}

/**
 * Simpan rule sebagai VERSI BARU.
 *
 * Rule baru (ruleKey belum ada) → versi 1. Rule yang sudah ada → versi
 * berikutnya, dan versi sebelumnya ditutup masa berlakunya sehari sebelum
 * versi baru mulai. Tidak ada baris yang ditimpa atau dihapus.
 */
export async function saveRuleVersion(input: RuleInput, ctx: SaveContext) {
  if (!hasSigningKey()) {
    throw new ValidationError(
      "PAYROLL_RULE_SIGNING_KEY belum diset — rule tidak bisa ditandatangani, " +
        "jadi tidak bisa disimpan."
    );
  }

  if (!/^[a-z][a-z0-9_]*$/.test(input.ruleKey)) {
    throw new ValidationError(
      "Kode rule hanya boleh huruf kecil, angka, dan garis bawah, diawali huruf."
    );
  }

  const existing = await prisma.payrollRule.findMany({
    where: { ruleKey: input.ruleKey },
    orderBy: { version: "desc" },
    take: 1,
    include: { tiers: true },
  });
  const previous = existing[0] ?? null;

  // SQL hanya boleh berubah oleh pemegang capability terpisah. Untuk rule baru
  // capability itu wajib — sebuah rule tidak bisa ada tanpa query.
  let sql = input.sql;
  if (!ctx.canEditSql) {
    if (!previous) {
      throw new ForbiddenError(
        "Membuat rule baru berarti menulis query-nya. Butuh izin “Ubah SQL Rule Gaji”."
      );
    }
    // Nilai lama dipertahankan paksa, bukan sekadar field yang di-disable di UI.
    sql = previous.sql;
  }

  const version = previous ? previous.version + 1 : 1;
  const spec = toSpecRule({ ...input, sql }, version);

  const { errors } = validateRule(spec, `${input.ruleKey}@v${version}`);
  if (errors.length > 0) {
    throw new ValidationError(`Rule belum valid:\n• ${errors.join("\n• ")}`);
  }

  if (previous && input.effectiveFrom <= isoOf(previous.effectiveFrom)) {
    throw new ValidationError(
      `Versi baru harus mulai berlaku SETELAH versi ${previous.version} ` +
        `(${isoOf(previous.effectiveFrom)}). Masa berlaku dua versi tidak boleh beririsan.`
    );
  }

  const tiers = input.tiers.map((t, i) => ({
    sortOrder: i,
    min: t.min,
    max: t.max,
    nominal: t.nominal,
    perUnit: t.perUnit,
    unitField: t.unitField,
    formula: t.formula,
    label: t.label,
    mandatorySaturday: t.mandatorySaturday ?? false,
    warningLetter: t.warningLetter ?? false,
  }));

  const signature = signRule({
    ruleKey: input.ruleKey,
    version,
    effectiveFrom: input.effectiveFrom,
    effectiveTo: input.effectiveTo,
    mode: input.mode,
    sql,
    tierField: input.tierField,
    constants: input.constants,
    guards: input.guards,
    defaults: input.defaults,
    targets: input.targets,
    excepts: input.excepts,
    tiers,
  });

  try {
    return await prisma.$transaction(async (tx) => {
      const created = await tx.payrollRule.create({
        data: {
          ruleKey: input.ruleKey,
          version,
          effectiveFrom: utcDate(input.effectiveFrom),
          effectiveTo: input.effectiveTo ? utcDate(input.effectiveTo) : null,
          mode: input.mode,
          sql,
          tierField: input.tierField,
          constants: input.constants ?? undefined,
          guards: (input.guards ?? undefined) as unknown as
            | Prisma.InputJsonValue
            | undefined,
          defaults: input.defaults,
          // Prisma mengetik kolom Json sebagai objek; array sah sebagai JSON tapi
          // tidak lolos tipe `InputJsonObject`, jadi perlu cast di sini.
          targets: input.targets as unknown as Prisma.InputJsonValue,
          excepts: (input.excepts ?? undefined) as unknown as Prisma.InputJsonValue | undefined,
          note: input.note,
          changeNote: input.changeNote,
          signature,
          createdById: ctx.userId,
          supersedesId: previous?.id ?? null,
          tiers: { create: tiers },
        },
        include: { tiers: true },
      });

      // Menutup masa berlaku versi sebelumnya. Sehari sebelum versi baru mulai,
      // kalau versi lama sudah punya `effectiveTo` yang lebih awal, memakainya
      // — batas yang sudah ditetapkan manusia tidak boleh dimundurkan diam-diam.
      const closedTo = previous
        ? minIso(
            previous.effectiveTo ? isoOf(previous.effectiveTo) : null,
            dayBefore(input.effectiveFrom)
          )
        : null;

      if (previous && closedTo && (!previous.effectiveTo || isoOf(previous.effectiveTo) !== closedTo)) {
        // Tanda tangan versi lama ikut dihitung ulang karena `effectiveTo`
        // termasuk yang ditandatangani — tanpa ini, versi lama langsung gagal
        // verifikasi dan berhenti bisa menjelaskan slip yang sudah dibayar.
        const prevTiers = previous.tiers
          .map((t) => ({
            sortOrder: t.sortOrder,
            min: t.min,
            max: t.max,
            nominal: t.nominal,
            perUnit: t.perUnit,
            formula: t.formula,
            unitField: t.unitField,
            label: t.label,
            mandatorySaturday: t.mandatorySaturday,
            warningLetter: t.warningLetter,
          }))
          .sort((a, b) => a.sortOrder - b.sortOrder);

        await tx.payrollRule.update({
          where: { id: previous.id },
          data: {
            effectiveTo: utcDate(closedTo),
            signature: signRule({
              ruleKey: previous.ruleKey,
              version: previous.version,
              effectiveFrom: previous.effectiveFrom,
              effectiveTo: closedTo,
              mode: previous.mode,
              sql: previous.sql,
              tierField: previous.tierField,
              constants: previous.constants,
              guards: previous.guards,
              defaults: previous.defaults,
              targets: previous.targets,
              excepts: previous.excepts,
              tiers: prevTiers,
            }),
          },
        });
      }

      return created;
    });
  } catch (e) {
    throw terjemahkanBentrokMasaBerlaku(e, input.ruleKey);
  }
}

/**
 * Constraint `payroll_rule_no_overlap` (migrasi 20260805020000) menolak dua
 * versi rule yang masa berlakunya beririsan.
 *
 * Pemeriksaan aplikasi di atas sudah menangkap kasus yang lazim, tapi ia
 * membaca versi terakhir SEBELUM menulis — dua permintaan yang berjalan
 * bersamaan bisa sama-sama lolos, dan yang menyelamatkan keadaan justru
 * database. Tanpa terjemahan ini, yang sampai ke HR adalah pesan Postgres
 * mentah yang tidak menjelaskan apa yang salah.
 */
function terjemahkanBentrokMasaBerlaku(e: unknown, ruleKey: string): unknown {
  const pesan = e instanceof Error ? e.message : String(e);
  if (!pesan.includes("payroll_rule_no_overlap")) return e;
  return new ValidationError(
    `Masa berlaku rule "${ruleKey}" beririsan dengan versi lain yang sudah ada. ` +
      "Tutup dulu masa berlaku versi sebelumnya, atau mulai versi ini setelah " +
      "versi itu berakhir."
  );
}

function isoOf(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Yang lebih awal dari dua tanggal ISO. `null` berarti belum ada batas. */
export function minIso(a: string | null, b: string): string {
  return a !== null && a < b ? a : b;
}
