// Bentuk data rule reward/denda slip gaji, sebagaimana ditulis di file per PT.
//
// Ini BUKAN bentuk penyimpanannya. Yang tersimpan adalah tabel PayrollRule +
// PayrollRuleTier (prisma/schema/payroll-rule.prisma); tipe di sini hanya
// bentuk benih yang dipakai `payroll-rules.seeder.ts` untuk mengisi database
// yang masih kosong. Setelah terisi, HR menyunting rule lewat halaman
// "Rule Reward & Denda" — bukan lewat file ini.
//
// Acuan lengkap tiap field: docs/tasks/spesifikasi-rule-slip-gaji.md

export type RuleMode = 'agregat' | 'per_baris'

/**
 * Satu baris tier. Tepat SATU dari nominal/perUnit/formula yang boleh diisi.
 *
 * Nilainya BERTANDA: positif menambah gaji, negatif menguranginya. Rule tidak
 * punya tipe — arah uang sepenuhnya milik tier/guard yang cocok, sehingga satu
 * rule bisa membonus skor tinggi dan memotong skor rendah sekaligus.
 */
export type TierSeed = {
  /** Batas bawah inklusif. Tanpa `min` berarti tidak terbatas ke bawah. */
  min?: number
  /** Batas atas inklusif. Tanpa `max` berarti tidak terbatas ke atas. */
  max?: number
  nominal?: number
  perUnit?: number
  /** Kolom hasil query yang dikalikan `perUnit`. Wajib menyertai perUnit. */
  unitField?: string
  formula?: string
  /** Alasan yang tampil di slip gaji. Wajib, dan wajib tidak kosong. */
  label: string
  /** Tier ini mewajibkan masuk setiap Sabtu. Tidak memengaruhi nominal. */
  mandatorySaturday?: boolean
  /** Tier ini disertai Surat Peringatan. Tidak memengaruhi nominal. */
  warningLetter?: boolean
}

/**
 * Kondisi bebas yang dinilai SEBELUM tier, berurutan; yang pertama cocok
 * menang. Dipakai untuk syarat yang tidak bisa dinyatakan sebagai rentang pada
 * satu kolom.
 */
export type GuardSeed = {
  /** Ekspresi perbandingan, mis. `jumlah_baris == 0`. */
  if: string
  /** `skip` membatalkan rule; `terapkan` langsung memakai nominal/formula. */
  aksi: 'skip' | 'terapkan'
  flag: string
  /** Hanya untuk `terapkan`. BERTANDA, sama seperti tier. */
  nominal?: number
  formula?: string
  /** Wajib untuk `terapkan` — jadi alasan yang tampil di slip. */
  label?: string
  mandatorySaturday?: boolean
  warningLetter?: boolean
}

/** Satu grup sasaran. Field yang dihilangkan dianggap `'*'`. */
export type TargetSeed = {
  company?: string[] | '*'
  branch?: string[] | '*'
  roles?: string[] | '*'
}

export type RuleSeed = {
  /** Identitas rule yang stabil sepanjang umurnya — jadi PayrollRule.ruleKey. */
  ruleKey: string
  effectiveFrom: string
  effectiveTo?: string | null
  mode: RuleMode
  /** Query pengumpul data. Hanya SELECT, hanya dari view `hv_*`. */
  sql: string
  /** Kolom hasil query yang dipakai mencocokkan tier. */
  tierField: string
  constants?: Record<string, number>
  guards?: GuardSeed[]
  tiers: TierSeed[]
  /** Dipakai kalau tidak ada tier yang cocok. Wajib ada. */
  defaults: { nominal?: number; formula?: string; label?: string; flag?: string }
  targets: TargetSeed[]
  excepts?: TargetSeed[]
  /** Keterangan untuk manusia — dasar kebijakan, sumber sheet, dst. */
  note?: string
}
