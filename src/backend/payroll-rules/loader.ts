// ═══════════════════════════════════════════════════════════════════════════
// Memuat rule dari database.
//
// Rule dulu hidup sebagai file .json di repo. Sekarang ia tinggal di tabel
// PayrollRule, dengan tiga penjaga yang menggantikan apa yang dulu dijamin git:
//
//   • append-only  — mengubah rule membuat versi baru, bukan menimpa
//   • signature    — baris yang disunting di luar aplikasi DITOLAK
//   • permission   — SQL hanya bisa disunting pemegang payroll.rules.sql
//
// Validasi tetap dijalankan setiap kali rule dimuat, bukan hanya saat disimpan.
// Baris bisa berubah lewat jalur yang tidak kita duga; yang menentukan uang
// keluar atau tidak harus diperiksa di titik ia dipakai.
// ═══════════════════════════════════════════════════════════════════════════

import { createHash } from "node:crypto";

import prisma from "@/lib/prisma";
import { validateRule } from "./validate";
import { verifyRuleSignature, type SignableRule } from "./signature";
import type { LoadedRule, PayrollRule, RuleSet, RuleTier } from "./types";

/** Baris PayrollRule + tier-nya, seperti dibaca dari Prisma. */
type RuleRow = {
  id: string;
  ruleKey: string;
  version: number;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  mode: string;
  sql: string;
  tierField: string;
  constants: unknown;
  guards: unknown;
  defaults: unknown;
  targets: unknown;
  excepts: unknown;
  note: string | null;
  signature: string;
  tiers: {
    sortOrder: number;
    min: unknown;
    max: unknown;
    nominal: unknown;
    perUnit: unknown;
    formula: string | null;
    unitField: string | null;
    label: string;
    mandatorySaturday: boolean;
    warningLetter: boolean;
  }[];
};

const MODE_TO_SPEC: Record<string, PayrollRule["mode"]> = {
  AGREGAT: "agregat",
  PER_BARIS: "per_baris",
};

function num(v: unknown): number | undefined {
  if (v === null || v === undefined) return undefined;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * `YYYY-MM-DD` dalam UTC.
 *
 * SATU formatter untuk seluruh modul rule, dan sengaja UTC: tanggal-saja di
 * proyek ini selalu mengalir sebagai UTC-midnight (lihat
 * backend/helpers/date-only.ts), dan kolom `@db.Date` dibaca Prisma dengan
 * konvensi yang sama. Formatter lokal akan menggeser tanggal sejauh offset
 * zona waktu server — cukup untuk membuat masa berlaku rule meleset sehari
 * tanpa menimbulkan error apa pun.
 */
export function toIsoDate(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate()
  ).padStart(2, "0")}`;
}

/**
 * Baris DB → bentuk rule yang dipahami validator & engine.
 *
 * Bentuk internal engine tetap memakai istilah spesifikasi (`tipe`, `mode`,
 * `tiers`, `for`) supaya validator, evaluator, dan dokumen acuan tidak perlu
 * dibongkar hanya karena tempat penyimpanannya berpindah.
 */
function toSpecRule(row: RuleRow): PayrollRule {
  const tiers: RuleTier[] = [...row.tiers]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((t) => ({
      min: num(t.min),
      max: num(t.max),
      nominal: num(t.nominal),
      per_unit: num(t.perUnit),
      unit_field: t.unitField ?? undefined,
      formula: t.formula ?? undefined,
      label: t.label,
      mandatory_saturday: t.mandatorySaturday,
      warning_letter: t.warningLetter,
    }));

  return {
    id: row.ruleKey,
    versi: row.version,
    berlaku_dari: toIsoDate(row.effectiveFrom),
    berlaku_sampai: row.effectiveTo ? toIsoDate(row.effectiveTo) : null,
    mode: MODE_TO_SPEC[row.mode] ?? (row.mode.toLowerCase() as PayrollRule["mode"]),
    query: {
      sql: row.sql,
      expect: row.mode === "AGREGAT" ? "one_row" : "many_rows",
    },
    konstanta: (row.constants as Record<string, number> | null) ?? undefined,
    guard: (row.guards as PayrollRule["guard"]) ?? undefined,
    tier_field: row.tierField,
    tiers,
    default: (row.defaults as PayrollRule["default"]) ?? { nominal: 0 },
    for: (row.targets as PayrollRule["for"]) ?? [],
    except: (row.excepts as PayrollRule["except"]) ?? undefined,
    catatan: row.note ?? undefined,
  };
}

function signablePart(row: RuleRow): SignableRule {
  return {
    ruleKey: row.ruleKey,
    version: row.version,
    effectiveFrom: row.effectiveFrom,
    effectiveTo: row.effectiveTo,
    mode: row.mode,
    sql: row.sql,
    tierField: row.tierField,
    constants: row.constants,
    guards: row.guards,
    defaults: row.defaults,
    targets: row.targets,
    excepts: row.excepts,
    tiers: row.tiers,
  };
}

export async function loadRuleSet(): Promise<RuleSet> {
  const rows = (await prisma.payrollRule.findMany({
    orderBy: [{ ruleKey: "asc" }, { version: "asc" }],
    include: { tiers: { orderBy: { sortOrder: "asc" } } },
  })) as unknown as RuleRow[];

  const rules: LoadedRule[] = rows.map((row) => {
    const rule = toSpecRule(row);
    // Nama "file" dipertahankan sebagai identitas yang dibaca manusia — kini
    // menunjuk baris DB, bukan file. Dipakai di pesan error dan halaman Rule.
    const file = `${row.ruleKey}@v${row.version}`;
    const { errors, warnings } = validateRule(rule, file);

    // Verifikasi tanda tangan SETELAH validasi struktur, supaya rule yang
    // memang salah bentuk menampilkan kesalahan sebenarnya lebih dulu.
    if (!verifyRuleSignature(signablePart(row), row.signature)) {
      errors.unshift(
        "Tanda tangan tidak cocok — isi rule ini berubah di luar aplikasi, atau " +
          "PAYROLL_RULE_SIGNING_KEY berbeda dari saat rule disimpan. Rule tidak " +
          "dijalankan sampai disimpan ulang lewat halaman Rule."
      );
    }

    return { rule, file, hash: row.signature, errors, warnings, rowId: row.id };
  });

  // `rulesetHash` sebuah PayrollRun: gabungan tanda tangan seluruh rule.
  // Dua run dengan angka berbeda jadi bisa dibedakan antara "datanya berubah"
  // dan "rule-nya berubah".
  const hash = createHash("sha256")
    .update(rules.map((r) => `${r.file}:${r.hash}`).sort().join("\n"))
    .digest("hex");

  crossVersionChecks(rules);

  return {
    rules,
    broken: [],
    hash,
    versions: rules.map((r) => `${r.rule.id}@${r.rule.versi}`).sort(),
  };
}

/**
 * Dua versi rule yang masa berlakunya beririsan membuat engine tidak punya
 * jawaban tunggal untuk "rule mana yang berlaku bulan ini".
 *
 * `@@unique([ruleKey, version])` sudah mencegah versi ganda di tingkat DB, jadi
 * yang tersisa hanya pemeriksaan rentang tanggal.
 */
function crossVersionChecks(rules: LoadedRule[]) {
  const byKey = new Map<string, LoadedRule[]>();
  for (const r of rules) {
    byKey.set(r.rule.id, [...(byKey.get(r.rule.id) ?? []), r]);
  }

  for (const group of byKey.values()) {
    const sorted = [...group].sort((a, b) =>
      a.rule.berlaku_dari.localeCompare(b.rule.berlaku_dari)
    );
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      const prevEnd = prev.rule.berlaku_sampai ?? "9999-12-31";
      if (cur.rule.berlaku_dari <= prevEnd) {
        const msg =
          `Masa berlaku beririsan dengan v${prev.rule.versi} (berlaku s/d ` +
          `${prev.rule.berlaku_sampai ?? "seterusnya"}, sedangkan v${cur.rule.versi} ` +
          `mulai ${cur.rule.berlaku_dari}). Tutup masa berlaku versi lama.`;
        cur.errors.push(msg);
        prev.errors.push(msg);
      }
    }
  }
}

/**
 * Rule yang berlaku pada tanggal tersebut — TERMASUK yang gagal validasi atau
 * gagal verifikasi tanda tangan.
 *
 * Rule bermasalah sengaja TIDAK disaring di sini. Sebelumnya ia dibuang diam-
 * diam, sehingga rule yang tanda tangannya tidak cocok — persis keadaan yang
 * ingin ditangkap HMAC — membuat bonus karyawan hilang tanpa satu baris pun
 * penjelasan di slip. Yang memutuskan apa yang terjadi dengan rule bermasalah
 * adalah engine: ia mencatatnya sebagai entri berstatus ERROR beserta
 * alasannya, tidak menghasilkan uang, dan slipnya masuk antrian review.
 *
 * Penyaringan tanggal tetap di sini: rule yang belum/sudah tidak berlaku
 * memang bukan urusan periode ini, jadi tidak perlu muncul di slip sama sekali.
 */
export function activeRulesOn(set: RuleSet, date: Date): LoadedRule[] {
  const iso = toIsoDate(date);
  return set.rules
    .filter((r) => r.rule.berlaku_dari <= iso)
    .filter((r) => !r.rule.berlaku_sampai || r.rule.berlaku_sampai >= iso);
}
