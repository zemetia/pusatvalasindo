/**
 * Setiap definisi KPI adalah terjemahan langsung dari kolom catatan pada
 * docs/PVI Data/PUSAT KPI SEMUA_.xlsx — teks aslinya disalin ke `description`
 * supaya aturan yang dipakai HR bisa dicek ulang tanpa membuka Excel.
 *
 * `defaultInputSource` menentukan siapa yang boleh mencatat:
 *   SELF       — karyawan mencatat sendiri (biasanya + persetujuan atasan)
 *   SUPERVISOR — hanya atasan/HR; karyawan tidak bisa menghapus temuan atas dirinya
 *   SYSTEM     — diambil otomatis dari modul lain, tidak bisa diinput manual
 */
export type KpiSeed = {
  code: string
  name: string
  objective?: string
  description: string
  scoringType:
    | 'TARGET_VALUE'
    | 'PENALTY_POINT'
    | 'REWARD_POINT'
    | 'PENALTY_PERCENT'
    | 'TOLERANCE_LIMIT'
    | 'BOOLEAN_DAILY'
  unit: 'OCCURRENCE' | 'CURRENCY' | 'POINT' | 'PERCENT' | 'DAY' | 'PERSON'
  direction?: 'HIGHER_BETTER' | 'LOWER_BETTER'
  defaultInputSource: 'SELF' | 'SUPERVISOR' | 'SYSTEM'
  defaultRequiresApproval: boolean
  defaultRequiresEvidence?: boolean
  systemSourceKey?: string
}
