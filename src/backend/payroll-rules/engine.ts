// ═══════════════════════════════════════════════════════════════════════════
// Engine: menjalankan rule untuk satu karyawan pada satu periode.
//
// Urutan evaluasi mengikuti bagian 7 spesifikasi:
//   targeting → query → guard → tier → hitung → default → simpan
//
// Prinsip yang menentukan bentuk kode ini: KALAU ENGINE TIDAK YAKIN, ENGINE
// TIDAK MEMOTONG UANG. Query gagal, nilai kosong, tier tidak cocok — semuanya
// menghasilkan entri berstatus SKIPPED/ERROR beserta alasannya, bukan angka
// hasil tebakan. Slip harus bisa menjelaskan kenapa sebuah rule tidak jalan.
// ═══════════════════════════════════════════════════════════════════════════

import prisma from "@/lib/prisma";
import { queryViewOnly } from "@/lib/db-view-only";
import {
  MissingValueError,
  evaluate,
  parseCondition,
  parseFormula,
  roundRupiah,
} from "./formula";
import { activeRulesOn, loadRuleSet, toIsoDate } from "./loader";
import { targetingIsUsable } from "./validate";
import { entryTypeOf } from "./types";
import type {
  EmployeeContext,
  EntryBreakdownRow,
  LoadedRule,
  PayrollRule,
  PeriodContext,
  RuleEntry,
  RuleEvaluationResult,
  RuleGuard,
  RuleTarget,
  RuleTier,
} from "./types";

/** Baris hasil query — kolomnya ditentukan rule, jadi tidak bisa diketik ketat. */
type QueryRow = Record<string, unknown>;

// ── Targeting ──────────────────────────────────────────────────────────────

/**
 * `"*"` atau field yang dihilangkan cocok dengan apa saja. Selain itu daftar
 * dicocokkan ke kode/nama MAUPUN id — file rule ditulis tangan, jadi menuntut
 * cuid di dalamnya akan membuatnya tidak terbaca manusia.
 */
function matchesField(spec: string[] | "*" | undefined, values: (string | null)[]): boolean {
  if (spec === undefined || spec === "*") return true;
  return spec.some((s) => values.some((v) => v !== null && v === s));
}

function matchesTarget(t: RuleTarget, emp: EmployeeContext): boolean {
  return (
    matchesField(t.company, [emp.companyCode, emp.companyId]) &&
    matchesField(t.branch, [emp.branchName, emp.branchId]) &&
    matchesField(t.roles, [emp.roleName, emp.customRoleId])
  );
}

/** `match = any(for) AND NOT any(except)` — `except` selalu menang. */
export function ruleTargetsEmployee(rule: PayrollRule, emp: EmployeeContext): boolean {
  const included = rule.for.some((t) => matchesTarget(t, emp));
  if (!included) return false;
  return !(rule.except ?? []).some((t) => matchesTarget(t, emp));
}

// ── Query ──────────────────────────────────────────────────────────────────

/**
 * Named parameter → placeholder posisional Postgres.
 *
 * Lookbehind `(?<!:)` melindungi cast Postgres (`x::text`) supaya tidak
 * terbaca sebagai parameter bernama `:text`.
 */
export function bindNamedParams(
  sql: string,
  params: Record<string, unknown>
): { text: string; values: unknown[] } {
  const values: unknown[] = [];
  const index = new Map<string, number>();

  const text = sql.replace(/(?<!:):([a-z_][a-z0-9_]*)/gi, (whole, name: string) => {
    if (!(name in params)) return whole; // validator sudah menolak yang tak dikenal
    let pos = index.get(name);
    if (pos === undefined) {
      values.push(params[name]);
      pos = values.length;
      index.set(name, pos);
    }
    return `$${pos}`;
  });

  return { text, values };
}

async function runQuery(
  rule: PayrollRule,
  emp: EmployeeContext,
  period: PeriodContext
): Promise<QueryRow[]> {
  const { text, values } = bindNamedParams(rule.query.sql, {
    employee_id: emp.id,
    // Batas periode dikirim sebagai STRING 'YYYY-MM-DD', bukan objek Date.
    //
    // Ini bukan kosmetik. Driver mengirim Date sebagai timestamp beserta
    // zona waktunya, lalu Postgres membandingkannya dengan kolom `date` —
    // dan pada proses yang berjalan di WIB, `31 Agustus 00:00 WIB` adalah
    // `30 Agustus 17:00 UTC`, sehingga `BETWEEN` MEMBUANG hari terakhir
    // setiap bulan. Tanpa error, hanya angka yang salah, dan hanya di server
    // yang zona waktunya bukan UTC. Sebagai string, Postgres membacanya
    // sebagai tanggal apa adanya.
    periode_awal: toIsoDate(period.awal),
    periode_akhir: toIsoDate(period.akhir),
    periode_bulan: period.bulan,
    periode_tahun: period.tahun,
    company_id: emp.companyId,
    branch_id: emp.branchId,
    custom_role_id: emp.customRoleId,
  });

  // SENGAJA bukan `prisma.$queryRawUnsafe`. SQL ini ditulis manusia dan
  // disimpan di database; ia hanya boleh berjalan lewat koneksi read-only yang
  // cuma punya SELECT atas view hv_*. Lihat lib/db-view-only.ts.
  const rows = await queryViewOnly<QueryRow>(text, values);
  return rows.map(normalizeRow);
}

/**
 * `COUNT`/`SUM` di Postgres kembali sebagai BigInt atau Decimal lewat driver.
 * Dinormalkan di sini supaya formula dan perbandingan tier bekerja dengan
 * angka biasa. `null` dibiarkan `null` — ia berarti "tidak ada data", dan itu
 * urusan guard, bukan urusan konversi.
 */
function normalizeRow(row: QueryRow): QueryRow {
  const out: QueryRow = {};
  for (const [k, v] of Object.entries(row)) {
    if (typeof v === "bigint") out[k] = Number(v);
    else if (v !== null && typeof v === "object" && "toNumber" in (v as object)) {
      out[k] = (v as { toNumber(): number }).toNumber();
    } else out[k] = v;
  }
  return out;
}

// ── Scope ekspresi ─────────────────────────────────────────────────────────

function buildScope(
  rule: PayrollRule,
  row: QueryRow,
  emp: EmployeeContext,
  period: PeriodContext
): Record<string, unknown> {
  return {
    ...row,
    ...(rule.konstanta ?? {}),
    "karyawan.gaji_pokok": emp.gaji_pokok,
    "karyawan.tgl_masuk": emp.tgl_masuk,
    "periode.awal": period.awal,
    "periode.akhir": period.akhir,
    "periode.jumlah_hari": period.jumlah_hari,
    "periode.bulan": period.bulan,
    "periode.tahun": period.tahun,
  };
}

/** Hanya nilai yang benar-benar dipakai — `inputs` slip harus bisa dibaca. */
function pickInputs(scope: Record<string, unknown>, row: QueryRow, rule: PayrollRule) {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(row)) out[k] = serializable(scope[k]);
  for (const k of Object.keys(rule.konstanta ?? {})) out[k] = scope[k];
  return out;
}

function serializable(v: unknown): unknown {
  if (v instanceof Date) return toIsoDate(v);
  if (typeof v === "bigint") return Number(v);
  return v;
}

// ── Tier ───────────────────────────────────────────────────────────────────

export function tierLabelOf(tier: RuleTier): string {
  const parts: string[] = [];
  if (typeof tier.min === "number") parts.push(`min:${tier.min}`);
  if (typeof tier.max === "number") parts.push(`max:${tier.max}`);
  return parts.join(",") || "semua";
}

function matchTier(tiers: RuleTier[], value: number): RuleTier | null {
  return (
    tiers.find(
      (t) =>
        (typeof t.min !== "number" || value >= t.min) &&
        (typeof t.max !== "number" || value <= t.max)
    ) ?? null
  );
}

// ── Evaluasi satu rule ─────────────────────────────────────────────────────

function skipped(rule: PayrollRule, label: string, flag: string, inputs: Record<string, unknown> = {}): RuleEntry {
  return {
    ruleId: rule.id,
    ruleVersion: rule.versi,
    // Entri tanpa uang tidak punya arah. `bonus` dipakai sebagai nilai netral
    // karena nominalnya nol — ia tidak masuk penjumlahan mana pun.
    tipe: "bonus",
    status: "SKIPPED",
    tier: null,
    label,
    amount: 0,
    inputs,
    breakdown: null,
    formula: null,
    flag,
    // Sanksi non-uang hanya berlaku untuk tier yang benar-benar dipakai.
    mandatorySaturday: false,
    warningLetter: false,
  };
}

function errored(rule: PayrollRule, label: string, flag: string): RuleEntry {
  return { ...skipped(rule, label, flag), status: "ERROR" };
}

/**
 * Entri untuk rule yang tidak layak dijalankan — gagal validasi bentuk, masa
 * berlakunya beririsan dengan versi lain, atau tanda tangannya tidak cocok.
 *
 * Seluruh pesan error ikut disimpan di `inputs.alasan` supaya slip lampau tetap
 * bisa menjelaskan dirinya sendiri bertahun-tahun kemudian — pesan yang sama
 * belum tentu masih bisa dihasilkan ulang, karena rule-nya mungkin sudah
 * diperbaiki sejak itu.
 */
function brokenRuleEntry(loaded: LoadedRule): RuleEntry {
  return {
    ruleId: loaded.rule.id,
    ruleVersion: loaded.rule.versi,
    tipe: "bonus",
    status: "ERROR",
    tier: null,
    label: `Rule "${loaded.file}" tidak dijalankan karena bermasalah — perlu diperiksa HR`,
    amount: 0,
    inputs: { rule: loaded.file, alasan: loaded.errors },
    breakdown: null,
    formula: null,
    flag: "rule_bermasalah",
    mandatorySaturday: false,
    warningLetter: false,
  };
}

async function evaluateRule(
  rule: PayrollRule,
  emp: EmployeeContext,
  period: PeriodContext
): Promise<RuleEntry | null> {
  if (!ruleTargetsEmployee(rule, emp)) return null;

  let rows: QueryRow[];
  try {
    rows = await runQuery(rule, emp, period);
  } catch (e) {
    return errored(
      rule,
      `Query rule gagal dijalankan: ${e instanceof Error ? e.message : String(e)}`,
      "query_gagal"
    );
  }

  if (rule.mode === "agregat") {
    // Query agregat wajib mengembalikan tepat satu baris, termasuk saat tidak
    // ada data. Nol baris berarti query-nya yang salah bentuk, bukan datanya
    // yang kosong — dan guard tidak punya apa pun untuk dievaluasi.
    if (rows.length === 0) {
      return errored(
        rule,
        "Query mode agregat tidak mengembalikan baris sama sekali.",
        "query_tanpa_baris"
      );
    }
    if (rows.length > 1) {
      return errored(
        rule,
        `Query mode agregat mengembalikan ${rows.length} baris, seharusnya satu.`,
        "query_banyak_baris"
      );
    }
    return evaluateAggregate(rule, rows[0], emp, period);
  }

  return evaluatePerRow(rule, rows, emp, period);
}

function evaluateAggregate(
  rule: PayrollRule,
  row: QueryRow,
  emp: EmployeeContext,
  period: PeriodContext
): RuleEntry {
  const scope = buildScope(rule, row, emp, period);
  const inputs = pickInputs(scope, row, rule);

  // Guard dulu — sebelum tier, sebelum uang. Yang pertama cocok menang dan
  // menghentikan sisanya, termasuk menghentikan pencocokan tier.
  for (const g of rule.guard ?? []) {
    let hit: boolean;
    try {
      hit = evaluate(parseCondition(g.if), scope) !== 0;
    } catch (e) {
      if (e instanceof MissingValueError) {
        return skipped(rule, `Guard tidak bisa dinilai — ${e.message}.`, "nilai_tidak_lengkap", inputs);
      }
      return errored(rule, `Guard \`${g.if}\` gagal: ${e instanceof Error ? e.message : String(e)}`, "guard_gagal");
    }
    if (!hit) continue;

    if (g.aksi === "skip") {
      return skipped(rule, `Rule dilewati: ${g.if}`, g.flag, inputs);
    }

    try {
      return appliedGuard(rule, g, scope, inputs);
    } catch (e) {
      if (e instanceof MissingValueError) {
        return skipped(rule, `Guard tidak bisa dihitung — ${e.message}.`, "nilai_tidak_lengkap", inputs);
      }
      return errored(
        rule,
        `Guard \`${g.if}\` gagal dihitung: ${e instanceof Error ? e.message : String(e)}`,
        "guard_gagal"
      );
    }
  }

  const tierValue = row[rule.tier_field];
  if (tierValue === null || tierValue === undefined) {
    return skipped(
      rule,
      `Kolom \`${rule.tier_field}\` kosong — tier tidak bisa dicocokkan.`,
      "nilai_tidak_lengkap",
      inputs
    );
  }

  const tier = matchTier(rule.tiers, Number(tierValue));
  if (!tier) {
    return applyDefault(rule, scope, inputs);
  }

  try {
    const { amount, formula } = computeTier(tier, scope, rule);
    return {
      ruleId: rule.id,
      ruleVersion: rule.versi,
      tipe: entryTypeOf(amount),
      status: "APPLIED",
      tier: tierLabelOf(tier),
      label: tier.label,
      amount,
      inputs,
      breakdown: null,
      formula,
      flag: null,
      mandatorySaturday: tier.mandatory_saturday ?? false,
      warningLetter: tier.warning_letter ?? false,
    };
  } catch (e) {
    if (e instanceof MissingValueError) {
      return skipped(rule, `Formula tidak bisa dihitung — ${e.message}.`, "nilai_tidak_lengkap", inputs);
    }
    return errored(rule, `Formula gagal: ${e instanceof Error ? e.message : String(e)}`, "formula_gagal");
  }
}

function evaluatePerRow(
  rule: PayrollRule,
  rows: QueryRow[],
  emp: EmployeeContext,
  period: PeriodContext
): RuleEntry {
  // Guard mode per_baris dinilai terhadap ringkasan yang selalu tersedia:
  // jumlah baris. Tanpa baris sama sekali, rule tidak menghasilkan apa-apa —
  // tapi tetap tercatat supaya slip bisa menyatakan "tidak ada kejadian".
  if (rows.length === 0) {
    return {
      ...skipped(rule, "Tidak ada kejadian pada periode ini.", "tidak_ada_kejadian"),
      status: "APPLIED",
      amount: 0,
      flag: null,
      breakdown: [],
    };
  }

  const breakdown: EntryBreakdownRow[] = [];
  let total = 0;
  let firstError: string | null = null;
  const sanksi = { mandatorySaturday: false, warningLetter: false };

  for (const row of rows) {
    const scope = buildScope(rule, row, emp, period);
    const inputs = pickInputs(scope, row, rule);
    const tierValue = row[rule.tier_field];
    const keterangan = describeRow(row, rule.tier_field);

    if (tierValue === null || tierValue === undefined) {
      breakdown.push({
        keterangan,
        tier: null,
        label: `Kolom \`${rule.tier_field}\` kosong — baris dilewati.`,
        nominal: 0,
        inputs,
      });
      continue;
    }

    // `default` pada mode ini berlaku PER BARIS, bukan membatalkan seluruh entri.
    const tier = matchTier(rule.tiers, Number(tierValue));

    try {
      if (!tier) {
        const amount = defaultAmount(rule, scope);
        total += amount;
        breakdown.push({
          keterangan,
          tier: null,
          label: rule.default.label ?? "Tidak cocok tier mana pun (default)",
          nominal: amount,
          inputs,
        });
        continue;
      }
      const { amount } = computeTier(tier, scope, rule);
      total += amount;
      if (tier.mandatory_saturday) sanksi.mandatorySaturday = true;
      if (tier.warning_letter) sanksi.warningLetter = true;
      breakdown.push({ keterangan, tier: tierLabelOf(tier), label: tier.label, nominal: amount, inputs });
    } catch (e) {
      firstError ??= e instanceof Error ? e.message : String(e);
      breakdown.push({
        keterangan,
        tier: tier ? tierLabelOf(tier) : null,
        label: `Gagal dihitung: ${e instanceof Error ? e.message : String(e)}`,
        nominal: 0,
        inputs,
      });
    }
  }

  const applied = breakdown.filter((b) => b.nominal !== 0);
  const label =
    applied.length > 0
      ? // Label entri diambil dari tier yang benar-benar dipakai, bukan disusun
        // ulang — supaya angka dan alasannya tidak pernah berbeda.
        [...new Set(applied.map((b) => b.label))].join(" · ")
      : "Tidak ada kejadian yang berdampak pada gaji.";

  return {
    ruleId: rule.id,
    ruleVersion: rule.versi,
    // Mode per_baris menjumlahkan banyak baris yang arahnya bisa berbeda-beda
    // (mis. denda telat dan bonus lembur pada rule yang sama). Yang menentukan
    // arah entri adalah HASIL AKHIRNYA, bukan baris mana pun secara sendiri.
    tipe: entryTypeOf(total),
    status: "APPLIED",
    tier: null,
    label,
    amount: total,
    inputs: { jumlah_kejadian: rows.length },
    breakdown,
    formula: null,
    flag: firstError ? "sebagian_baris_gagal" : null,
    // Mode per_baris memakai banyak tier sekaligus; sanksi menyala kalau ada
    // SATU baris pun yang tiernya membawanya.
    mandatorySaturday: sanksi.mandatorySaturday,
    warningLetter: sanksi.warningLetter,
  };
}

/** Identitas baris untuk dibaca manusia — tanggal kalau ada, kalau tidak urutannya. */
function describeRow(row: QueryRow, tierField: string): string {
  for (const key of ["date", "tanggal", "tgl"]) {
    const v = row[key];
    if (v instanceof Date) return toIsoDate(v);
    if (typeof v === "string" && v) return v;
  }
  return `${tierField} = ${String(row[tierField])}`;
}

/**
 * Entri dari guard `aksi: "terapkan"` — kondisi bebas yang langsung menetapkan
 * nominal, tanpa melewati tier.
 */
function appliedGuard(
  rule: PayrollRule,
  g: RuleGuard,
  scope: Record<string, unknown>,
  inputs: Record<string, unknown>
): RuleEntry {
  const amount =
    g.formula !== undefined
      ? roundRupiah(evaluate(parseFormula(g.formula), scope))
      : (g.nominal ?? 0);

  return {
    ruleId: rule.id,
    ruleVersion: rule.versi,
    tipe: entryTypeOf(amount),
    status: "APPLIED",
    // Guard bukan tier, jadi tidak punya rentang. Kondisinyalah identitasnya —
    // dan itu yang perlu terbaca saat menelusuri slip lama.
    tier: `guard:${g.if}`,
    label: g.label ?? `Kondisi terpenuhi: ${g.if}`,
    amount,
    inputs,
    breakdown: null,
    formula: g.formula ?? null,
    // Flag tetap dibawa meski entrinya APPLIED: `terapkan` sering dipakai untuk
    // keadaan yang tetap ingin dilihat HR (mis. dibayar tapi belum berkontrak).
    flag: g.flag,
    mandatorySaturday: g.mandatory_saturday ?? false,
    warningLetter: g.warning_letter ?? false,
  };
}

function computeTier(
  tier: RuleTier,
  scope: Record<string, unknown>,
  _rule: PayrollRule
): { amount: number; formula: string | null } {
  if (tier.nominal !== undefined) {
    return { amount: tier.nominal, formula: null };
  }

  if (tier.per_unit !== undefined) {
    const unit = scope[tier.unit_field as string];
    if (unit === null || unit === undefined) {
      throw new MissingValueError(tier.unit_field as string);
    }
    return {
      amount: roundRupiah(tier.per_unit * Number(unit)),
      formula: `${tier.per_unit} × ${tier.unit_field}`,
    };
  }

  const src = tier.formula as string;
  return { amount: roundRupiah(evaluate(parseFormula(src), scope)), formula: src };
}

function defaultAmount(rule: PayrollRule, scope: Record<string, unknown>): number {
  if (rule.default.formula) {
    return roundRupiah(evaluate(parseFormula(rule.default.formula), scope));
  }
  return rule.default.nominal ?? 0;
}

function applyDefault(
  rule: PayrollRule,
  scope: Record<string, unknown>,
  inputs: Record<string, unknown>
): RuleEntry {
  try {
    const amount = defaultAmount(rule, scope);
    return {
      ruleId: rule.id,
      ruleVersion: rule.versi,
      tipe: entryTypeOf(amount),
      status: "APPLIED",
      tier: null,
      label: rule.default.label ?? "Tidak cocok tier mana pun (default)",
      amount,
      inputs,
      breakdown: null,
      formula: rule.default.formula ?? null,
      // Flag `default` biasanya "butuh_review": nilai yang jatuh ke default
      // berarti tier belum menutupi seluruh kemungkinan.
      flag: rule.default.flag ?? null,
      // `default` bukan tier, jadi tidak membawa sanksi non-uang. Menjatuhkan
      // SP karena skor tidak cocok tier mana pun berarti menghukum orang atas
      // konfigurasi rule yang belum lengkap.
      mandatorySaturday: false,
      warningLetter: false,
    };
  } catch (e) {
    return errored(rule, `Default gagal dihitung: ${e instanceof Error ? e.message : String(e)}`, "default_gagal");
  }
}

// ── Titik masuk ────────────────────────────────────────────────────────────

export function buildPeriodContext(month: number, year: number): PeriodContext {
  // Periode saat ini mengikuti bulan kalender. Kalau nanti perusahaan memakai
  // periode gaji tersendiri (mis. 26–25), yang berubah cukup fungsi ini —
  // PayrollRun sudah menyimpan rentangnya sebagai tanggal, bukan sebagai bulan.
  //
  // UTC-midnight, mengikuti konvensi tanggal-saja di seluruh proyek ini (lihat
  // backend/helpers/date-only.ts). Memakai `new Date(y, m, d)` akan membuat
  // batas periode bergeser mengikuti zona waktu server.
  const awal = new Date(Date.UTC(year, month - 1, 1));
  const akhir = new Date(Date.UTC(year, month, 0));
  return {
    awal,
    akhir,
    bulan: month,
    tahun: year,
    jumlah_hari: akhir.getUTCDate(),
  };
}

/**
 * Semua rule yang berlaku, dijalankan untuk satu karyawan.
 *
 * Tidak ada mekanisme pemenang: setiap rule yang cocok menghasilkan entrinya
 * sendiri. Kalau dua rule menghitung hal yang sama, itu masalah kebijakan yang
 * diselesaikan dengan menghapus salah satu rule — bukan diselesaikan diam-diam
 * di sini.
 */
export async function evaluateRulesForEmployee(
  emp: EmployeeContext,
  month: number,
  year: number
): Promise<RuleEvaluationResult> {
  const period = buildPeriodContext(month, year);
  const set = await loadRuleSet();
  const rules = activeRulesOn(set, period.akhir);

  const entries: RuleEntry[] = [];
  for (const loaded of rules) {
    // Rule yang gagal validasi atau gagal verifikasi tanda tangan TIDAK
    // dijalankan — tapi juga tidak boleh menghilang. Kalau ia lenyap, karyawan
    // kehilangan bonusnya tanpa penjelasan apa pun, dan justru kasus yang
    // paling penting (tanda tangan tidak cocok = isi rule diubah di luar
    // aplikasi) yang paling sunyi. Entri ERROR di bawah ini yang membuat slip
    // bisa menjawab "kenapa bonus saya tidak keluar bulan ini".
    if (loaded.errors.length > 0) {
      // Sasaran tetap disaring lebih dulu. Rule rusak yang memang bukan untuk
      // karyawan ini tidak boleh muncul di slipnya — kalau tidak, seorang teller
      // menerima belasan baris "rule bermasalah" tentang rule kurir dan kepala
      // cabang, dan yang benar-benar mengenai dirinya tenggelam di antaranya.
      //
      // Kecuali kalau justru bagian sasarannya yang rusak: menyaring dengan
      // sasaran yang tidak sah akan membuang rule dari SEMUA slip tanpa jejak.
      // Dalam keadaan itu rule sengaja ditampilkan ke semua orang yang mungkin
      // terkena — terlalu ramai jauh lebih baik daripada senyap.
      if (targetingIsUsable(loaded.rule) && !ruleTargetsEmployee(loaded.rule, emp)) continue;
      entries.push(brokenRuleEntry(loaded));
      continue;
    }
    const entry = await evaluateRule(loaded.rule, emp, period);
    if (entry) entries.push(entry);
  }

  // Urutan tampil: penambahan dulu, lalu pengurangan (bagian 6 spesifikasi).
  entries.sort((a, b) => {
    const rank = (t: string) => (t === "bonus" ? 0 : 1);
    return rank(a.tipe) - rank(b.tipe) || a.ruleId.localeCompare(b.ruleId);
  });

  // Dipilah dari TANDA nominal, bukan dari tipe rule — sebuah rule sekarang
  // bisa menyumbang ke kedua sisi lewat kondisi yang berbeda.
  const applied = entries.filter((e) => e.status === "APPLIED");
  const totalBonus = applied.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0);
  const totalPenalty = Math.abs(
    applied.filter((e) => e.amount < 0).reduce((s, e) => s + e.amount, 0)
  );

  return {
    entries,
    totalBonus,
    totalPenalty,
    netAmount: totalBonus - totalPenalty,
    needsReview: entries.some((e) => e.status !== "APPLIED" || e.flag !== null),
    mandatorySaturday: entries.some((e) => e.status === "APPLIED" && e.mandatorySaturday),
    warningLetter: entries.some((e) => e.status === "APPLIED" && e.warningLetter),
    rulesetHash: set.hash,
    rulesetVersions: set.versions,
  };
}

/** Konteks karyawan dari database — satu tempat supaya field-nya tidak menyimpang. */
export async function loadEmployeeContext(employeeId: string): Promise<EmployeeContext | null> {
  const u = await prisma.user.findUnique({
    where: { id: employeeId },
    select: {
      id: true,
      name: true,
      baseSalary: true,
      joinDate: true,
      branchId: true,
      customRoleId: true,
      branch: { select: { name: true, companyId: true, company: { select: { code: true } } } },
      customRole: { select: { name: true } },
    },
  });
  if (!u) return null;

  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

  return {
    id: u.id,
    name: u.name,
    companyCode: u.branch?.company?.code ?? null,
    branchName: u.branch?.name ?? null,
    roleName: u.customRole?.name ?? null,
    gaji_pokok: num(u.baseSalary),
    tgl_masuk: u.joinDate ?? null,
    companyId: u.branch?.companyId ?? null,
    branchId: u.branchId ?? null,
    customRoleId: u.customRoleId ?? null,
  };
}
