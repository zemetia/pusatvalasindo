// PT PUSAT VALAS INDO — rule reward/denda slip gaji.
//
// Benih untuk tabel PayrollRule + PayrollRuleTier. Angka dan SQL di sini hanya
// dipakai saat rule dengan ruleKey yang sama BELUM ada di database; sesudahnya
// HR menyunting lewat halaman "Rule Reward & Denda" dan file ini tidak lagi
// berpengaruh. Acuan field: docs/tasks/spesifikasi-rule-slip-gaji.md
//
// SATU RULE PER JABATAN. Potongan dan bonus tinggal bersama di satu daftar
// tier, dibedakan oleh TANDA nominalnya — persis seperti sheet manajemen
// menuliskannya (ekstraksi-kpi-bonus.md §5): satu tabel, band bawah dipotong,
// band atas dibonus. Sebelumnya keduanya terpisah menjadi `bonus_kpi_*` dan
// `denda_kpi_*` yang menyalin SQL, guard, dan sasaran yang sama persis.

import { DEFAULT_KPI, KPI_BULANAN_SQL, guardsKpi } from './kpi-source'
import type { RuleSeed } from './types'

/** Catatan yang berlaku untuk seluruh rule KPI PVI. */
const CATATAN_UMUM =
  'Skor dicocokkan sebagai PERSEN BULAT: ROUND(total_score * 100) — lihat ' +
  'kpi-source.ts. Sanksi non-moneter (wajib masuk Sabtu, SP, teguran lisan) ' +
  'dibawa terpisah dari nominal lewat mandatorySaturday/warningLetter; ' +
  'penerbitan suratnya sendiri di luar rule engine.'

export const PVI_RULES: RuleSeed[] = [
  {
    ruleKey: 'kpi_pvi_kepala_cabang',
    effectiveFrom: '2026-08-01',
    effectiveTo: null,
    mode: 'agregat',
    sql: KPI_BULANAN_SQL,
    tierField: 'skor_persen',
    guards: guardsKpi(86),
    tiers: [
      { max: 74, nominal: -300000, label: 'Potongan KPI Kepala Cabang (skor ≤74%) — disertai SP', warningLetter: true },
      { min: 75, max: 85, nominal: 0, label: 'Skor KPI 75–85% — safe zone, tanpa bonus maupun potongan' },
      { min: 86, max: 100, nominal: 500000, label: 'Bonus KPI Kepala Cabang (skor 86–100%)' },
      { min: 101, max: 120, nominal: 1000000, label: 'Bonus KPI Kepala Cabang (skor 101–120%)' },
      { min: 121, nominal: 1500000, label: 'Bonus KPI Kepala Cabang (skor di atas 120%)' },
    ],
    defaults: DEFAULT_KPI,
    targets: [{ company: ['PVI'], branch: '*', roles: ['Kepala Cabang'] }],
    note:
      'Sumber: PUSAT KPI SEMUA_2.xlsx, matriks bonus PVI (ekstraksi-kpi-bonus.md §5). ' +
      'Potongan Rp 300.000 + SP untuk skor ≤74% dulu berdiri sebagai rule ' +
      '`denda_kpi_pvi_kepala_cabang`; sekarang menjadi tier bernominal negatif di ' +
      'rule yang sama.\n\n' +
      CATATAN_UMUM,
  },

  {
    ruleKey: 'kpi_pvi_kepala_marketing',
    effectiveFrom: '2026-08-01',
    effectiveTo: null,
    mode: 'agregat',
    sql: KPI_BULANAN_SQL,
    tierField: 'skor_persen',
    guards: guardsKpi(86),
    tiers: [
      { max: 79, nominal: -200000, label: 'Potongan KPI Kepala Marketing (skor ≤79%) — disertai teguran lisan' },
      { min: 80, max: 85, nominal: 0, label: 'Skor KPI 80–85% — safe zone, tanpa bonus maupun potongan' },
      { min: 86, max: 100, nominal: 500000, label: 'Bonus KPI Kepala Marketing (skor 86–100%)' },
      { min: 101, max: 120, nominal: 500000, label: 'Bonus KPI Kepala Marketing (skor 101–120%)' },
      { min: 121, nominal: 1250000, label: 'Bonus KPI Kepala Marketing (skor di atas 120%)' },
    ],
    defaults: DEFAULT_KPI,
    targets: [{ company: ['PVI'], branch: '*', roles: ['Kepala Marketing'] }],
    note:
      'Sumber: PUSAT KPI SEMUA_2.xlsx, matriks bonus PVI (ekstraksi-kpi-bonus.md §5).\n\n' +
      'PERHATIAN pada band 101–120%. Sheet manajemen HANYA menulis dua angka untuk ' +
      'jabatan ini: 86–100% → 500.000 dan di atas 120% → 1.250.000. Band 101–120% ' +
      'tidak pernah ditetapkan (tercatat sebagai masalah #11 di ekstraksi-kpi-bonus.md), ' +
      'sementara tier tidak boleh berlubang — validator menolak rule yang meninggalkan ' +
      'rentang tanpa jawaban. Diisi 500.000, yaitu MENERUSKAN band di bawahnya, karena ' +
      'itu satu-satunya angka yang benar-benar tertulis untuk jabatan ini; menaikkannya ' +
      'ke 1.000.000 seperti Kepala Cabang berarti mengarang kebijakan. Begitu manajemen ' +
      'menetapkan angkanya, simpan versi baru lewat halaman Rule.\n\n' +
      CATATAN_UMUM,
  },

  {
    ruleKey: 'kpi_pvi_marketing',
    effectiveFrom: '2026-08-01',
    effectiveTo: null,
    mode: 'agregat',
    sql: KPI_BULANAN_SQL,
    tierField: 'skor_persen',
    guards: guardsKpi(86),
    tiers: [
      { max: 69, nominal: 0, label: 'Skor KPI ≤69% — tanpa bonus, sanksi wajib masuk setiap Sabtu', mandatorySaturday: true },
      { min: 70, max: 85, nominal: 0, label: 'Skor KPI 70–85% — safe zone, tanpa bonus maupun potongan' },
      { min: 86, nominal: 250000, label: 'Bonus KPI Marketing (skor 86% ke atas)' },
    ],
    defaults: DEFAULT_KPI,
    targets: [{ company: ['PVI'], branch: '*', roles: ['Marketing'] }],
    note:
      'Sumber: PUSAT KPI SEMUA_2.xlsx, matriks bonus PVI (ekstraksi-kpi-bonus.md §5).\n\n' +
      'Sheet menulis band tertinggi sebagai "86%-100%" dan tidak mengatur apa pun di ' +
      'atas 100% — padahal skor di atas 100% nyata terjadi (sales PKD 144% pada Juli ' +
      '2026). Band teratas karena itu dibuat TANPA batas atas dengan nominal yang sama, ' +
      'bukan dibiarkan jatuh ke default: karyawan yang bekerja lebih baik tidak boleh ' +
      'kehilangan bonus yang sudah didapat rekannya yang skornya lebih rendah.\n\n' +
      'Bonus "top number 1" senilai Rp 500.000 ada di rule tersendiri, ' +
      '`bonus_top_kpi_pvi`.\n\n' +
      CATATAN_UMUM,
  },

  {
    ruleKey: 'kpi_pvi_teller_dalam',
    effectiveFrom: '2026-08-01',
    effectiveTo: null,
    mode: 'agregat',
    sql: KPI_BULANAN_SQL,
    tierField: 'skor_persen',
    guards: guardsKpi(86),
    tiers: [
      { max: 59, nominal: -300000, label: 'Potongan KPI Teller Dalam (skor ≤59%) — disertai wajib masuk setiap Sabtu', mandatorySaturday: true },
      { min: 60, max: 85, nominal: 0, label: 'Skor KPI 60–85% — safe zone, tanpa bonus maupun potongan' },
      { min: 86, nominal: 500000, label: 'Bonus KPI Teller Dalam (skor 86% ke atas)' },
    ],
    defaults: DEFAULT_KPI,
    targets: [{ company: ['PVI'], branch: '*', roles: ['Teller Dalam'] }],
    note:
      'Sumber: PUSAT KPI SEMUA_2.xlsx, matriks bonus PVI (ekstraksi-kpi-bonus.md §5). ' +
      'Sheet menulis sanksi "10-60%" sementara safe zone "60-85%" — nilai 60 diklaim ' +
      'dua band (masalah #13). Diselesaikan ke arah yang menguntungkan karyawan: 60% ' +
      'masuk safe zone, sehingga band sanksi menjadi ≤59%.\n\n' +
      CATATAN_UMUM,
  },

  {
    ruleKey: 'kpi_pvi_teller_luar',
    effectiveFrom: '2026-08-01',
    effectiveTo: null,
    mode: 'agregat',
    sql: KPI_BULANAN_SQL,
    tierField: 'skor_persen',
    guards: guardsKpi(86),
    tiers: [
      { max: 59, nominal: -100000, label: 'Potongan KPI Teller Luar (skor ≤59%) — disertai wajib masuk setiap Sabtu', mandatorySaturday: true },
      { min: 60, max: 85, nominal: 0, label: 'Skor KPI 60–85% — safe zone, tanpa bonus maupun potongan' },
      { min: 86, nominal: 250000, label: 'Bonus KPI Teller Luar (skor 86% ke atas)' },
    ],
    defaults: DEFAULT_KPI,
    targets: [{ company: ['PVI'], branch: '*', roles: ['Teller Luar'] }],
    note:
      'Sumber: PUSAT KPI SEMUA_2.xlsx, matriks bonus PVI (ekstraksi-kpi-bonus.md §5). ' +
      'Nilai 60 diselesaikan ke safe zone, sama seperti Teller Dalam.\n\n' +
      CATATAN_UMUM,
  },

  {
    ruleKey: 'kpi_pvi_kurir',
    effectiveFrom: '2026-08-01',
    effectiveTo: null,
    mode: 'agregat',
    sql: KPI_BULANAN_SQL,
    tierField: 'skor_persen',
    guards: guardsKpi(86),
    tiers: [
      { max: 60, nominal: 0, label: 'Skor KPI ≤60% — tanpa bonus, sanksi wajib masuk setiap Sabtu', mandatorySaturday: true },
      { min: 61, max: 85, nominal: 0, label: 'Skor KPI 61–85% — safe zone, tanpa bonus maupun potongan' },
      { min: 86, nominal: 250000, label: 'Bonus KPI Kurir (skor 86% ke atas)' },
    ],
    defaults: DEFAULT_KPI,
    targets: [{ company: ['PVI'], branch: '*', roles: ['Kurir'] }],
    note:
      'Sumber: PUSAT KPI SEMUA_2.xlsx, matriks bonus PVI (ekstraksi-kpi-bonus.md §5). ' +
      'Sheet menulis safe zone "61-85%" dan sanksi "10-70%" — rentang 61–70% diklaim ' +
      'dua-duanya (masalah #12). Diselesaikan ke safe zone, jadi sanksi berhenti di 60%. ' +
      'Kurir tidak kena potongan rupiah, hanya kewajiban masuk Sabtu.\n\n' +
      'Bonus "top number 1" senilai Rp 500.000 ada di `bonus_top_kpi_pvi`.\n\n' +
      CATATAN_UMUM,
  },
]
