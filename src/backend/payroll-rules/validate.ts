// ═══════════════════════════════════════════════════════════════════════════
// Validasi file rule. Bagian 8 spesifikasi.
//
// Semua pemeriksaan di sini harus gagal SEBELUM payroll jalan, bukan saat
// jalan. Rule yang tidak lolos tidak ikut dievaluasi — lebih baik satu rule
// hilang dan kelihatan di halaman Rule daripada satu rule menghitung gaji
// orang dengan keliru dan tidak kelihatan sama sekali.
// ═══════════════════════════════════════════════════════════════════════════

import {
  ExpressionError,
  collectRefs,
  findZeroDivision,
  parseCondition,
  parseFormula,
} from "./formula";
import type { PayrollRule, RuleGuard, RuleTarget, RuleTier } from "./types";

/** Parameter yang disediakan engine. Di luar daftar ini = error. */
export const ALLOWED_PARAMS = [
  "employee_id",
  "periode_awal",
  "periode_akhir",
  "periode_bulan",
  "periode_tahun",
  "company_id",
  "branch_id",
  "custom_role_id",
] as const;

/** Field `karyawan.*` yang boleh dirujuk formula. */
export const EMPLOYEE_FIELDS = [
  "gaji_pokok",
  "uang_makan",
  "uang_transport",
  "tunjangan_jabatan",
  "bpjs_kesehatan",
  "tgl_masuk",
] as const;

/** Field `periode.*` yang boleh dirujuk formula. */
export const PERIOD_FIELDS = ["awal", "akhir", "jumlah_hari", "bulan", "tahun"] as const;

/**
 * Query rule hanya boleh menyentuh view pelaporan `hv_*`.
 *
 * Penegak sesungguhnya adalah database: query dijalankan lewat koneksi
 * `DATABASE_VIEW_ONLY_URL` yang cuma punya SELECT atas view-view itu. Cek di
 * sini ada supaya salah tabel ketahuan saat rule DISIMPAN — dengan pesan yang
 * menyebut nama tabelnya — bukan berupa error izin database saat payroll
 * sedang berjalan.
 */
const VIEW_PREFIX = "hv_";

const MUTATING_KEYWORDS = [
  "insert",
  "update",
  "delete",
  "drop",
  "alter",
  "truncate",
  "create",
  "grant",
  "revoke",
  "copy",
  "merge",
  "call",
  "do",
];

export interface ValidationOutcome {
  errors: string[];
  warnings: string[];
}

/**
 * Validasi satu objek JSON menjadi rule yang layak dievaluasi.
 *
 * Mengembalikan daftar error alih-alih melempar: halaman Rule perlu
 * menampilkan SEMUA masalah sekaligus, bukan yang pertama saja.
 */
export function validateRule(raw: unknown, file: string): ValidationOutcome {
  const errors: string[] = [];
  const warnings: string[] = [];
  const err = (m: string) => errors.push(m);

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { errors: [`${file}: isi file bukan objek JSON.`], warnings };
  }
  const r = raw as Partial<PayrollRule>;

  // ── Identitas ────────────────────────────────────────────────────────────
  if (typeof r.id !== "string" || !r.id.trim()) err("`id` wajib diisi.");
  if (typeof r.versi !== "number" || !Number.isInteger(r.versi) || r.versi < 1) {
    err("`versi` wajib bilangan bulat ≥ 1.");
  }
  if (!isIsoDate(r.berlaku_dari)) {
    err("`berlaku_dari` wajib tanggal ISO (YYYY-MM-DD).");
  }
  if (r.berlaku_sampai != null && !isIsoDate(r.berlaku_sampai)) {
    err("`berlaku_sampai` harus tanggal ISO (YYYY-MM-DD) atau null.");
  }
  if (
    isIsoDate(r.berlaku_dari) &&
    isIsoDate(r.berlaku_sampai) &&
    (r.berlaku_sampai as string) < (r.berlaku_dari as string)
  ) {
    err("`berlaku_sampai` lebih awal daripada `berlaku_dari`.");
  }

  if (r.mode !== "agregat" && r.mode !== "per_baris") {
    err('`mode` harus "agregat" atau "per_baris".');
  }

  // ── Konstanta ────────────────────────────────────────────────────────────
  const constants: Record<string, number> = {};
  if (r.konstanta !== undefined) {
    if (typeof r.konstanta !== "object" || r.konstanta === null || Array.isArray(r.konstanta)) {
      err("`konstanta` harus objek {nama: angka}.");
    } else {
      for (const [k, v] of Object.entries(r.konstanta)) {
        if (typeof v !== "number" || !Number.isFinite(v)) {
          err(`Konstanta "${k}" harus angka.`);
          continue;
        }
        constants[k] = v;
      }
    }
  }

  // ── Query ────────────────────────────────────────────────────────────────
  const queryColumns = new Set<string>();
  if (typeof r.query !== "object" || r.query === null) {
    err("`query` wajib diisi.");
  } else {
    const sql = (r.query as { sql?: unknown }).sql;
    const expect = (r.query as { expect?: unknown }).expect;

    if (typeof sql !== "string" || !sql.trim()) {
      err("`query.sql` wajib diisi.");
    } else {
      validateSql(sql, err, warnings);
      for (const col of extractColumns(sql)) queryColumns.add(col);
    }

    if (expect !== "one_row" && expect !== "many_rows") {
      err('`query.expect` harus "one_row" atau "many_rows".');
    } else if (r.mode === "agregat" && expect !== "one_row") {
      err('Mode "agregat" wajib `query.expect: "one_row"`.');
    } else if (r.mode === "per_baris" && expect !== "many_rows") {
      err('Mode "per_baris" wajib `query.expect: "many_rows"`.');
    }
  }

  // Nama yang sah dirujuk formula/guard.
  const knownRef = (name: string): boolean => {
    if (name.startsWith("karyawan.")) {
      return (EMPLOYEE_FIELDS as readonly string[]).includes(name.slice("karyawan.".length));
    }
    if (name.startsWith("periode.")) {
      return (PERIOD_FIELDS as readonly string[]).includes(name.slice("periode.".length));
    }
    const bare = name.replace(/^konstanta\./, "");
    if (bare in constants) return true;
    // Kolom hasil query tidak bisa diketahui pasti tanpa menjalankan query;
    // yang dipakai adalah alias yang terbaca dari teks SQL. Kalau tidak
    // terbaca, jadi warning di bawah — bukan error — supaya query dengan
    // bentuk tak lazim tidak otomatis memblokir rule.
    return queryColumns.has(bare);
  };

  // ── tier_field ───────────────────────────────────────────────────────────
  if (typeof r.tier_field !== "string" || !r.tier_field.trim()) {
    err("`tier_field` wajib diisi.");
  } else if (queryColumns.size > 0 && !queryColumns.has(r.tier_field)) {
    warnings.push(
      `\`tier_field\` "${r.tier_field}" tidak terbaca sebagai alias di query. ` +
        `Alias yang terbaca: ${[...queryColumns].join(", ") || "—"}.`
    );
  }

  // ── Tiers ────────────────────────────────────────────────────────────────
  if (!Array.isArray(r.tiers) || r.tiers.length === 0) {
    err("`tiers` wajib berisi minimal satu tier.");
  } else {
    r.tiers.forEach((tier, i) => {
      validateTier(tier, i, r.mode, queryColumns, constants, knownRef, err, warnings);
    });
    checkTierCoverage(r.tiers, err);
  }

  // ── Default ──────────────────────────────────────────────────────────────
  if (typeof r.default !== "object" || r.default === null) {
    err("`default` wajib ada — dipakai kalau tidak ada tier yang cocok.");
  } else {
    const d = r.default;
    const filled = [d.nominal !== undefined, d.formula !== undefined].filter(Boolean).length;
    if (filled === 0) err("`default` harus punya `nominal` atau `formula`.");
    if (filled > 1) err("`default` hanya boleh mengisi salah satu dari `nominal`/`formula`.");
    if (d.nominal !== undefined && typeof d.nominal !== "number") {
      err("`default.nominal` harus angka.");
    }
    if (d.formula !== undefined) {
      checkExpression(d.formula, "default.formula", constants, knownRef, err, warnings);
    }
  }

  // ── Guard ────────────────────────────────────────────────────────────────
  if (r.guard !== undefined) {
    if (!Array.isArray(r.guard)) {
      err("`guard` harus array.");
    } else if (r.guard.length > 0 && r.mode === "per_baris") {
      // Engine hanya menilai guard di mode agregat. Membiarkannya lolos berarti
      // guard yang ditulis HR tidak pernah berjalan — dan itu tidak terlihat
      // di mana pun: tidak ada error, tidak ada entri, hanya rule yang membayar
      // orang yang seharusnya tidak dibayar.
      err(
        '`guard` belum didukung di `mode: "per_baris"` — engine tidak menilainya. ' +
          "Pindahkan syaratnya ke WHERE di dalam query, atau pecah menjadi rule " +
          "tersendiri bermode agregat."
      );
    } else {
      r.guard.forEach((g, i) => validateGuard(g, i, constants, knownRef, err, warnings));
    }
  }

  // ── Targeting ────────────────────────────────────────────────────────────
  if (!Array.isArray(r.for) || r.for.length === 0) {
    err("`for` wajib berisi minimal satu grup sasaran.");
  } else {
    r.for.forEach((t, i) => validateTarget(t, `for[${i}]`, err));
  }
  if (r.except !== undefined) {
    if (!Array.isArray(r.except)) err("`except` harus array.");
    else r.except.forEach((t, i) => validateTarget(t, `except[${i}]`, err));
  }

  return { errors, warnings };
}

// ── Bagian-bagian ──────────────────────────────────────────────────────────

function validateGuard(
  g: RuleGuard,
  index: number,
  constants: Record<string, number>,
  knownRef: (name: string) => boolean,
  err: (m: string) => void,
  warnings: string[]
) {
  const at = `guard[${index}]`;

  if (typeof g?.if !== "string" || !g.if.trim()) {
    err(`${at}: \`if\` wajib diisi.`);
    return;
  }
  if (g.aksi !== "skip" && g.aksi !== "terapkan") {
    err(`${at}: \`aksi\` harus "skip" atau "terapkan".`);
  }
  if (typeof g.flag !== "string" || !g.flag.trim()) {
    err(`${at}: \`flag\` wajib diisi — slip harus bisa menjelaskan kenapa kondisi ini kena.`);
  }

  try {
    const node = parseCondition(g.if);
    for (const ref of collectRefs(node)) {
      if (!knownRef(ref)) {
        warnings.push(
          `${at}: rujukan "${ref}" tidak dikenali sebagai kolom query, konstanta, karyawan.*, atau periode.*.`
        );
      }
    }
  } catch (e) {
    err(`${at}: ${e instanceof ExpressionError ? e.message : String(e)}`);
  }

  const ways = [g.nominal !== undefined, g.formula !== undefined].filter(Boolean).length;

  if (g.aksi === "terapkan") {
    if (ways === 0) err(`${at}: \`aksi: "terapkan"\` harus mengisi \`nominal\` atau \`formula\`.`);
    if (ways > 1) err(`${at}: hanya boleh mengisi SALAH SATU dari \`nominal\`/\`formula\`.`);
    if (g.nominal !== undefined && typeof g.nominal !== "number") {
      err(`${at}: \`nominal\` harus angka.`);
    }
    if (g.formula !== undefined) {
      checkExpression(g.formula, `${at}.formula`, constants, knownRef, err, warnings);
    }
    if (typeof g.label !== "string" || !g.label.trim()) {
      err(`${at}: \`label\` wajib diisi — ia jadi alasan yang tampil di slip.`);
    }
  } else if (ways > 0 || g.label !== undefined) {
    // `skip` yang membawa nominal hampir selalu berarti maksudnya `terapkan`
    // dan aksinya lupa diganti. Dibiarkan lolos, angkanya hilang tanpa suara.
    err(`${at}: \`nominal\`/\`formula\`/\`label\` hanya bermakna pada \`aksi: "terapkan"\`.`);
  }

  if (g.aksi !== "terapkan" && (g.mandatory_saturday || g.warning_letter)) {
    err(`${at}: sanksi non-uang hanya bisa menyertai \`aksi: "terapkan"\`.`);
  }
}

function validateTier(
  tier: RuleTier,
  index: number,
  mode: unknown,
  queryColumns: Set<string>,
  constants: Record<string, number>,
  knownRef: (name: string) => boolean,
  err: (m: string) => void,
  warnings: string[]
) {
  const at = `tiers[${index}]`;

  if (typeof tier !== "object" || tier === null) {
    err(`${at}: bukan objek.`);
    return;
  }

  if (typeof tier.label !== "string" || !tier.label.trim()) {
    err(`${at}: \`label\` wajib diisi — label inilah alasan yang tampil di slip.`);
  }

  for (const bound of ["min", "max"] as const) {
    if (tier[bound] !== undefined && typeof tier[bound] !== "number") {
      err(`${at}: \`${bound}\` harus angka.`);
    }
  }
  if (
    typeof tier.min === "number" &&
    typeof tier.max === "number" &&
    tier.min > tier.max
  ) {
    err(`${at}: \`min\` (${tier.min}) lebih besar daripada \`max\` (${tier.max}).`);
  }

  const ways = [
    tier.nominal !== undefined,
    tier.per_unit !== undefined,
    tier.formula !== undefined,
  ].filter(Boolean).length;

  if (ways === 0) err(`${at}: harus mengisi salah satu dari \`nominal\`, \`per_unit\`, atau \`formula\`.`);
  if (ways > 1) err(`${at}: hanya boleh mengisi SATU dari \`nominal\`, \`per_unit\`, atau \`formula\`.`);

  if (tier.nominal !== undefined && typeof tier.nominal !== "number") {
    err(`${at}: \`nominal\` harus angka.`);
  }

  if (tier.per_unit !== undefined) {
    if (typeof tier.per_unit !== "number") err(`${at}: \`per_unit\` harus angka.`);
    if (mode !== "per_baris") {
      err(`${at}: \`per_unit\` hanya boleh di \`mode: "per_baris"\`.`);
    }
    if (typeof tier.unit_field !== "string" || !tier.unit_field.trim()) {
      err(`${at}: \`per_unit\` wajib disertai \`unit_field\`.`);
    } else if (queryColumns.size > 0 && !queryColumns.has(tier.unit_field)) {
      warnings.push(
        `${at}: \`unit_field\` "${tier.unit_field}" tidak terbaca sebagai alias di query.`
      );
    }
  } else if (tier.unit_field !== undefined) {
    err(`${at}: \`unit_field\` hanya bermakna bersama \`per_unit\`.`);
  }

  if (tier.formula !== undefined) {
    checkExpression(tier.formula, `${at}.formula`, constants, knownRef, err, warnings);
  }
}

function checkExpression(
  src: unknown,
  at: string,
  constants: Record<string, number>,
  knownRef: (name: string) => boolean,
  err: (m: string) => void,
  warnings: string[]
) {
  if (typeof src !== "string" || !src.trim()) {
    err(`${at}: harus berupa string ekspresi.`);
    return;
  }
  try {
    const node = parseFormula(src);
    for (const ref of collectRefs(node)) {
      if (!knownRef(ref)) {
        warnings.push(
          `${at}: rujukan "${ref}" tidak dikenali sebagai kolom query, konstanta, karyawan.*, atau periode.*.`
        );
      }
    }
    const zero = findZeroDivision(node, constants);
    if (zero !== null) {
      err(`${at}: pembagian dengan nol (${zero}).`);
    }
  } catch (e) {
    err(`${at}: ${e instanceof ExpressionError ? e.message : String(e)}`);
  }
}

function validateTarget(t: RuleTarget, at: string, err: (m: string) => void) {
  if (typeof t !== "object" || t === null) {
    err(`${at}: bukan objek.`);
    return;
  }
  for (const key of ["company", "branch", "roles"] as const) {
    const v = t[key];
    if (v === undefined || v === "*") continue;
    if (!Array.isArray(v) || v.some((x) => typeof x !== "string")) {
      err(`${at}.${key}: harus "*" atau array string.`);
    } else if (v.length === 0) {
      err(`${at}.${key}: array kosong tidak akan pernah cocok — pakai "*" kalau maksudnya semua.`);
    }
  }
}

function validateSql(sql: string, err: (m: string) => void, warnings: string[]) {
  const trimmed = sql.trim();
  const lower = trimmed.toLowerCase();

  if (!/^(select|with)\b/.test(lower)) {
    err("`query.sql` wajib dimulai dengan SELECT atau WITH.");
  }

  // Satu statement saja. `;` di akhir masih diterima, di tengah tidak.
  const withoutTrailing = trimmed.replace(/;\s*$/, "");
  if (withoutTrailing.includes(";")) {
    err("`query.sql` hanya boleh berisi satu statement — ada `;` di tengah.");
  }

  for (const kw of MUTATING_KEYWORDS) {
    if (new RegExp(`\\b${kw}\\b`, "i").test(withoutTrailing)) {
      err(`\`query.sql\` memuat kata kunci yang mengubah data: ${kw.toUpperCase()}.`);
    }
  }

  // Parameter posisional tidak punya nama, jadi tidak bisa dicocokkan engine.
  if (/(?<!\?)\?(?!\?)/.test(withoutTrailing.replace(/'[^']*'/g, ""))) {
    err("`query.sql` memakai parameter posisional `?` — pakai named parameter.");
  }

  // `(?<!:)` melindungi cast Postgres (`x::text`) supaya tidak terbaca sebagai
  // parameter bernama — sama seperti `bindNamedParams` di engine.ts.
  const used = [...withoutTrailing.matchAll(/(?<!:):([a-z_][a-z0-9_]*)/gi)].map((m) => m[1]);
  for (const p of new Set(used)) {
    if (!(ALLOWED_PARAMS as readonly string[]).includes(p)) {
      err(`\`query.sql\` memakai parameter tidak dikenal: \`:${p}\`.`);
    }
  }

  validateSources(withoutTrailing, err);

  const hasRange = used.includes("periode_awal") || used.includes("periode_akhir");
  const hasMonthYear = used.includes("periode_bulan") && used.includes("periode_tahun");
  if (!hasRange && !hasMonthYear) {
    err(
      "`query.sql` tidak memuat filter periode. Tanpa itu agregat menjumlahkan " +
        "seluruh riwayat karyawan sejak dia masuk kerja — gagal tanpa error."
    );
  }

  if (!used.includes("employee_id")) {
    warnings.push(
      "`query.sql` tidak memakai `:employee_id`. Sengaja? Query lintas karyawan " +
        "biasanya tetap perlu memfilter barisnya di akhir."
    );
  }
}

/**
 * Setiap sumber baris setelah FROM/JOIN wajib berupa view `hv_*`.
 *
 * Sub-query (`FROM (`) dilewati — isinya ikut dipindai oleh regex yang sama,
 * jadi tabel terlarang di dalamnya tetap ketahuan. Nama CTE yang didefinisikan
 * lewat `WITH nama AS (...)` juga diizinkan, karena ia bukan tabel melainkan
 * hasil SELECT yang sudah diperiksa.
 */
function validateSources(sql: string, err: (m: string) => void) {
  const cteNames = new Set(
    [...sql.matchAll(/\b(?:with|,)\s+([a-z_][a-z0-9_]*)\s+as\s*\(/gi)].map((m) =>
      m[1].toLowerCase()
    )
  );

  const sources = [...sql.matchAll(/\b(?:from|join)\s+("?)([a-z_][a-z0-9_.]*)\1/gi)];

  for (const m of sources) {
    const raw = m[2];
    const parts = raw.split(".");
    const bare = (parts[parts.length - 1] || raw).toLowerCase();
    if (cteNames.has(bare)) continue;
    if (bare.startsWith(VIEW_PREFIX)) continue;
    err(
      `\`query.sql\` membaca "${raw}". Rule hanya boleh membaca view pelaporan ` +
        `berawalan \`${VIEW_PREFIX}\` (lihat sql/openclaw_setup.sql) — koneksi ` +
        `read-only yang menjalankannya memang tidak punya akses ke tabel lain.`
    );
  }

  if (sources.length === 0 && /\bfrom\b/i.test(sql)) {
    err("`query.sql` memakai FROM dengan bentuk yang tidak bisa diperiksa engine.");
  }
}

/**
 * Alias kolom yang terbaca dari teks SQL (`... AS nama`).
 *
 * Sengaja heuristik: engine tidak menjalankan query saat validasi, jadi ini
 * dipakai untuk WARNING, bukan untuk menolak rule.
 */
function extractColumns(sql: string): string[] {
  return [...sql.matchAll(/\bas\s+"?([a-z_][a-z0-9_]*)"?/gi)].map((m) => m[1]);
}

/**
 * Tier tidak boleh tumpang tindih dan tidak boleh berlubang.
 *
 * Rentang diperiksa pada bilangan bulat: `tier_field` selalu berupa hitungan
 * (hari, peringkat, nomor urut pelanggaran), bukan pecahan.
 */
function checkTierCoverage(tiers: RuleTier[], err: (m: string) => void) {
  const ranges = tiers
    .map((t, i) => ({
      i,
      min: typeof t.min === "number" ? t.min : Number.NEGATIVE_INFINITY,
      max: typeof t.max === "number" ? t.max : Number.POSITIVE_INFINITY,
    }))
    .filter((r) => r.min <= r.max)
    .sort((a, b) => a.min - b.min);

  for (let k = 1; k < ranges.length; k++) {
    const prev = ranges[k - 1];
    const cur = ranges[k];
    if (cur.min <= prev.max) {
      err(
        `tiers[${prev.i}] dan tiers[${cur.i}] tumpang tindih pada nilai ${cur.min}` +
          `–${Math.min(prev.max, cur.max)}. Kondisi belakangan tidak akan pernah tercapai.`
      );
    } else if (cur.min > prev.max + 1) {
      err(
        `Ada celah antara tiers[${prev.i}] dan tiers[${cur.i}]: nilai ` +
          `${prev.max + 1}–${cur.min - 1} tidak ditangani tier mana pun.`
      );
    }
  }
}

function isIsoDate(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
}
