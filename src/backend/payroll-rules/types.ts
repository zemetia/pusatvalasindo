// ═══════════════════════════════════════════════════════════════════════════
// Bentuk rule slip gaji, apa adanya seperti tertulis di file .json.
//
// Acuan: docs/tasks/spesifikasi-rule-slip-gaji.md
//
// Tipe di sini sengaja longgar di tempat-tempat yang tidak bisa dijamin oleh
// TypeScript (isi file JSON datang dari disk, bukan dari kode). Yang menegakkan
// bentuknya adalah validator di validate.ts — dijalankan saat file dimuat,
// sebelum payroll berjalan.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Arah sebuah ENTRI, bukan sebuah rule.
 *
 * Rule tidak punya tipe. Yang menambah atau mengurangi adalah tier/guard yang
 * cocok, dan arahnya dibaca dari TANDA nominalnya — lihat `entryTypeOf`.
 */
export type RuleType = "bonus" | "denda";
export type RuleMode = "agregat" | "per_baris";

/** Arah entri dari nominalnya. Nol dihitung sebagai bonus bernilai nol. */
export function entryTypeOf(amount: number): RuleType {
  return amount < 0 ? "denda" : "bonus";
}

/** Satu baris tier. Tepat satu dari nominal/per_unit/formula yang boleh diisi. */
export interface RuleTier {
  /** Batas bawah inklusif. Tanpa `min` berarti tidak terbatas ke bawah. */
  min?: number;
  /** Batas atas inklusif. Tanpa `max` berarti tidak terbatas ke atas. */
  max?: number;
  /** BERTANDA: positif menambah gaji, negatif menguranginya. */
  nominal?: number;
  per_unit?: number;
  /** Kolom hasil query yang dikalikan `per_unit`. Wajib menyertai per_unit. */
  unit_field?: string;
  formula?: string;
  /** Alasan yang tampil di slip. Wajib, dan wajib tidak kosong. */
  label: string;
  /** Sanksi non-uang yang menyertai tier ini — tidak memengaruhi nominal. */
  mandatory_saturday?: boolean;
  warning_letter?: boolean;
}

/** Nilai yang dipakai kalau tidak ada tier yang cocok. Wajib ada. */
export interface RuleDefault {
  nominal?: number;
  formula?: string;
  label?: string;
  flag?: string;
}

/**
 * Kondisi bebas yang dinilai sebelum tier. Yang pertama cocok menang.
 *
 * Guard ada karena tier hanya bisa mencocokkan RENTANG pada satu kolom
 * (`tier_field`). Kondisi yang menyangkut kolom lain — "belum berkontrak",
 * "tidak ada data KPI", "omzet nol padahal hadir penuh" — tidak bisa
 * dinyatakan sebagai tier tanpa memelintir query supaya semuanya muat di satu
 * angka.
 */
export interface RuleGuard {
  /** Ekspresi perbandingan, mis. `hari_tercatat == 0`. */
  if: string;
  /**
   * `skip`     — rule dibatalkan, tidak ada uang, alasannya tetap tercatat.
   * `terapkan` — nominal/formula guard langsung dipakai, tier tidak dilihat.
   */
  aksi: "skip" | "terapkan";
  flag: string;

  // ── Hanya untuk `aksi: "terapkan"` ───────────────────────────────────────

  /** BERTANDA, sama seperti tier: positif menambah, negatif mengurangi. */
  nominal?: number;
  formula?: string;
  /** Alasan yang tampil di slip. Wajib untuk `terapkan`. */
  label?: string;
  mandatory_saturday?: boolean;
  warning_letter?: boolean;
}

export interface RuleQuery {
  sql: string;
  expect: "one_row" | "many_rows";
}

/** Satu grup sasaran. Field yang dihilangkan dianggap `"*"`. */
export interface RuleTarget {
  company?: string[] | "*";
  branch?: string[] | "*";
  roles?: string[] | "*";
}

export interface PayrollRule {
  id: string;
  versi: number;
  berlaku_dari: string;
  berlaku_sampai?: string | null;
  mode: RuleMode;
  query: RuleQuery;
  konstanta?: Record<string, number>;
  guard?: RuleGuard[];
  tier_field: string;
  tiers: RuleTier[];
  default: RuleDefault;
  for: RuleTarget[];
  except?: RuleTarget[];
  /** Keterangan bebas untuk manusia. Tidak dipakai engine. */
  catatan?: string;
}

/** Rule beserta asal-usulnya — dipakai halaman Rule & pesan error. */
export interface LoadedRule {
  rule: PayrollRule;
  /** Identitas terbaca manusia, mis. `denda_keterlambatan@v2`. */
  file: string;
  /** Tanda tangan baris. Ikut membentuk `rulesetHash` sebuah PayrollRun. */
  hash: string;
  /** Primary key baris PayrollRule — dipakai UI untuk menyunting. */
  rowId: string;
  errors: string[];
  warnings: string[];
}

/**
 * Rule yang tidak bisa dibentuk sama sekali.
 *
 * Sisa dari era rule-sebagai-file, saat sebuah .json bisa gagal di-parse.
 * Baris database selalu punya bentuk, jadi sekarang selalu kosong — tetap ada
 * supaya halaman Rule tidak perlu dibongkar kalau nanti ada sumber rule lain.
 */
export interface BrokenRuleFile {
  file: string;
  hash: string;
  errors: string[];
}

export interface RuleSet {
  rules: LoadedRule[];
  broken: BrokenRuleFile[];
  /** Hash gabungan seluruh file. Disimpan di PayrollRun.rulesetHash. */
  hash: string;
  /** Daftar `id@versi` — disimpan di PayrollRun.rulesetVersion. */
  versions: string[];
}

// ── Konteks & hasil evaluasi ───────────────────────────────────────────────

/** Data karyawan yang boleh dirujuk formula lewat `karyawan.*`. */
export interface EmployeeContext {
  id: string;
  name: string;
  companyCode: string | null;
  branchName: string | null;
  roleName: string | null;
  gaji_pokok: number | null;
  uang_makan: number | null;
  uang_transport: number | null;
  tunjangan_jabatan: number | null;
  bpjs_kesehatan: number | null;
  tgl_masuk: Date | null;
  /** id mentah untuk parameter query. */
  companyId: string | null;
  branchId: string | null;
  customRoleId: string | null;
}

export interface PeriodContext {
  awal: Date;
  akhir: Date;
  bulan: number;
  tahun: number;
  jumlah_hari: number;
}

export type EntryStatus = "APPLIED" | "SKIPPED" | "ERROR";

/** Rincian satu baris pada rule `mode: per_baris`. */
export interface EntryBreakdownRow {
  /** Identitas baris untuk dibaca manusia — biasanya tanggal kejadian. */
  keterangan: string;
  tier: string | null;
  label: string;
  nominal: number;
  inputs: Record<string, unknown>;
}

/** Hasil satu rule untuk satu karyawan pada satu periode. */
export interface RuleEntry {
  ruleId: string;
  ruleVersion: number;
  /** Diturunkan dari tanda `amount`, bukan dari rule — lihat `entryTypeOf`. */
  tipe: RuleType;
  status: EntryStatus;
  /** Tier yang cocok, mis. "min:23" atau "min:1,max:3". */
  tier: string | null;
  label: string;
  /** Ditandatangani sesuai arah aslinya: bonus positif, denda/potongan negatif. */
  amount: number;
  inputs: Record<string, unknown>;
  breakdown: EntryBreakdownRow[] | null;
  formula: string | null;
  flag: string | null;
  /**
   * Sanksi non-uang dari tier yang cocok. Dibawa terpisah dari `amount`
   * karena bukan rupiah — slip perlu menampilkannya sebagai kewajiban, dan
   * laporan perlu bisa menyaringnya. Hanya berarti saat status APPLIED.
   */
  mandatorySaturday: boolean;
  warningLetter: boolean;
}

export interface RuleEvaluationResult {
  entries: RuleEntry[];
  /** Jumlah entri bernilai positif. */
  totalBonus: number;
  /** Jumlah entri bernilai negatif, disimpan positif. */
  totalPenalty: number;
  /** Pengaruh bersih ke gaji: totalBonus − totalPenalty. */
  netAmount: number;
  /** Ada entri SKIPPED/ERROR atau berflag — perlu dilihat manusia. */
  needsReview: boolean;
  /** Ada entri APPLIED yang mewajibkan masuk setiap Sabtu. */
  mandatorySaturday: boolean;
  /** Ada entri APPLIED yang disertai Surat Peringatan. */
  warningLetter: boolean;
  rulesetHash: string;
  rulesetVersions: string[];
}
