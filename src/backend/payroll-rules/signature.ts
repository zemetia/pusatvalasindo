// ═══════════════════════════════════════════════════════════════════════════
// Tanda tangan rule.
//
// Yang dilindungi di sini INTEGRITAS, bukan kerahasiaan. Isi rule — termasuk
// SQL-nya — memang ditampilkan di halaman Rule, jadi menyembunyikannya tidak
// ada gunanya. Yang harus dijamin: baris yang disunting langsung lewat klien
// SQL tidak boleh dipercaya.
//
// Karena itu HMAC, bukan enkripsi:
//   • Orang dengan akses tulis DB sama-sama tidak bisa memalsukan keduanya.
//   • Baris yang diubah gagal verifikasi dengan pesan yang jelas, bukan error
//     dekripsi yang tidak menjelaskan apa-apa.
//   • Database tetap terbaca — backup bisa diperiksa, rule bisa di-grep.
//   • Kunci hilang berarti tanda tangan ulang, bukan seluruh rule mati.
//
// Yang IKUT ditandatangani hanya hal yang memengaruhi perhitungan uang: query,
// tier, guard, konstanta, sasaran, dan masa berlaku. `note`/`changeNote`
// sengaja TIDAK ikut — memperbaiki salah ketik pada catatan tidak boleh
// membuat rule berhenti jalan.
// ═══════════════════════════════════════════════════════════════════════════

import { createHmac, timingSafeEqual } from "node:crypto";

/** Bentuk minimum yang bisa ditandatangani — cocok untuk baris DB maupun draft. */
export interface SignableRule {
  ruleKey: string;
  version: number;
  effectiveFrom: Date | string;
  effectiveTo: Date | string | null;
  mode: string;
  sql: string;
  tierField: string;
  constants: unknown;
  guards: unknown;
  defaults: unknown;
  targets: unknown;
  excepts: unknown;
  tiers: SignableTier[];
}

export interface SignableTier {
  sortOrder: number;
  min: unknown;
  max: unknown;
  nominal: unknown;
  perUnit: unknown;
  formula: string | null;
  unitField: string | null;
  label: string;
  // Ikut ditandatangani: mengubah "kena SP" menjadi "tidak kena SP" adalah
  // perubahan konsekuensi bagi karyawan, sama seriusnya dengan mengubah angka.
  mandatorySaturday?: boolean;
  warningLetter?: boolean;
}

export class SigningKeyMissingError extends Error {
  constructor() {
    super(
      "PAYROLL_RULE_SIGNING_KEY belum diset. Tanpa kunci ini rule tidak bisa " +
        "ditandatangani maupun diverifikasi, dan engine menolak menjalankannya."
    );
  }
}

function signingKey(): string {
  const key = process.env.PAYROLL_RULE_SIGNING_KEY;
  if (!key || key.trim().length < 16) throw new SigningKeyMissingError();
  return key;
}

/** Apakah kunci tersedia? Dipakai halaman untuk memberi peringatan yang tepat. */
export function hasSigningKey(): boolean {
  const key = process.env.PAYROLL_RULE_SIGNING_KEY;
  return Boolean(key && key.trim().length >= 16);
}

// ── Bentuk kanonik ─────────────────────────────────────────────────────────

/**
 * Angka dinormalkan lewat `Number` supaya Decimal("1000") dan Decimal("1000.00")
 * — yang identik secara nilai — menghasilkan tanda tangan yang sama. Nominal
 * gaji jauh di bawah batas presisi `Number`, jadi normalisasi ini aman.
 */
function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function isoDate(v: Date | string | null): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v.slice(0, 10);
  return `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, "0")}-${String(
    v.getUTCDate()
  ).padStart(2, "0")}`;
}

/**
 * JSON dengan kunci objek terurut, di segala kedalaman.
 *
 * `JSON.stringify` biasa mempertahankan urutan penyisipan, jadi dua objek yang
 * isinya sama persis tapi ditulis dengan urutan field berbeda akan menghasilkan
 * tanda tangan berbeda — dan rule yang sah tiba-tiba ditolak.
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

/** Payload yang ditandatangani. Diekspor supaya bisa diuji langsung. */
export function canonicalize(rule: SignableRule): string {
  return stableStringify({
    // v2: kolom `type` dibuang — arah uang pindah ke tanda nominal tiap tier.
    v: 2,
    ruleKey: rule.ruleKey,
    version: rule.version,
    effectiveFrom: isoDate(rule.effectiveFrom),
    effectiveTo: isoDate(rule.effectiveTo),
    mode: rule.mode,
    sql: rule.sql.trim(),
    tierField: rule.tierField,
    constants: rule.constants ?? null,
    guards: rule.guards ?? null,
    defaults: rule.defaults ?? null,
    targets: rule.targets ?? null,
    excepts: rule.excepts ?? null,
    tiers: [...rule.tiers]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((t) => ({
        sortOrder: t.sortOrder,
        min: num(t.min),
        max: num(t.max),
        nominal: num(t.nominal),
        perUnit: num(t.perUnit),
        formula: t.formula ?? null,
        unitField: t.unitField ?? null,
        label: t.label,
        mandatorySaturday: t.mandatorySaturday ?? false,
        warningLetter: t.warningLetter ?? false,
      })),
  });
}

export function signRule(rule: SignableRule): string {
  return createHmac("sha256", signingKey()).update(canonicalize(rule)).digest("hex");
}

/**
 * Verifikasi tanda tangan. Perbandingan memakai `timingSafeEqual` — bukan
 * karena serangan waktu realistis di sini, tapi karena membandingkan digest
 * dengan `===` adalah kebiasaan yang salah untuk ditiru di tempat lain.
 */
export function verifyRuleSignature(rule: SignableRule, signature: string): boolean {
  let expected: string;
  try {
    expected = signRule(rule);
  } catch {
    return false;
  }
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signature ?? "", "hex");
  if (a.length === 0 || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
