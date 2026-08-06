// PT PUSAT TUKAR UANG — rule reward/denda slip gaji.
//
// Benih untuk tabel PayrollRule + PayrollRuleTier. Angka dan SQL di sini hanya
// dipakai saat rule dengan ruleKey yang sama BELUM ada di database; sesudahnya
// HR menyunting lewat halaman "Rule Reward & Denda" dan file ini tidak lagi
// berpengaruh. Acuan field: docs/tasks/spesifikasi-rule-slip-gaji.md
//
// SATU RULE PER JABATAN — potongan dan bonus dibedakan oleh TANDA nominalnya.
// Lihat pvi.ts untuk penjelasan lengkapnya.

import { DEFAULT_KPI, KPI_BULANAN_SQL, guardsKpi } from './kpi-source'
import type { RuleSeed } from './types'

const CATATAN_UMUM =
  'Skor dicocokkan sebagai PERSEN BULAT: ROUND(total_score * 100) — lihat ' +
  'kpi-source.ts. Sanksi non-moneter (wajib masuk Sabtu, teguran lisan) dibawa ' +
  'terpisah dari nominal lewat mandatorySaturday/warningLetter.'

export const PTU_RULES: RuleSeed[] = [
  {
    ruleKey: 'kpi_ptu_kepala_cabang',
    effectiveFrom: '2020-01-01',
    effectiveTo: null,
    mode: 'agregat',
    sql: KPI_BULANAN_SQL,
    tierField: 'skor_persen',
    guards: guardsKpi(86),
    tiers: [
      { max: 79, nominal: -200000, label: 'Potongan KPI Kepala Cabang (skor ≤79%) — disertai teguran lisan' },
      { min: 80, max: 85, nominal: 0, label: 'Skor KPI 80–85% — safe zone, tanpa bonus maupun potongan' },
      { min: 86, max: 100, nominal: 500000, label: 'Bonus KPI Kepala Cabang (skor 86–100%)' },
      { min: 101, nominal: 1500000, label: 'Bonus KPI Kepala Cabang (skor 101% ke atas)' },
    ],
    defaults: DEFAULT_KPI,
    targets: [{ company: ['PTU'], branch: '*', roles: ['Kepala Cabang'] }],
    note:
      'Sumber: PUSAT KPI SEMUA_2.xlsx, matriks bonus PTU (ekstraksi-kpi-bonus.md §5).\n\n' +
      'Band teratas dibuat TANPA batas atas. Sheet _2 hanya menulis "101%-120% → ' +
      '1.500.000" dan kehilangan band "di atas 120%" yang ada di versi lama (masalah ' +
      '#14). Menutupnya di 120 berarti skor tertinggi justru tidak dibayar sama sekali; ' +
      'diteruskan pada nominal yang sama karena itu satu-satunya angka yang tertulis ' +
      'untuk band atas jabatan ini.\n\n' +
      'Perhatikan band 101%+ PTU membayar Rp 1.500.000 sedangkan PVI membayar ' +
      'Rp 1.000.000 di band yang sama — beda itu ada di sheet aslinya dan tercatat ' +
      'sebagai masalah #17, bukan salah salin.\n\n' +
      CATATAN_UMUM,
  },

  {
    ruleKey: 'kpi_ptu_teller_dalam',
    effectiveFrom: '2020-01-01',
    effectiveTo: null,
    mode: 'agregat',
    sql: KPI_BULANAN_SQL,
    tierField: 'skor_persen',
    guards: guardsKpi(85),
    tiers: [
      { max: 59, nominal: -150000, label: 'Potongan KPI Teller Dalam (skor ≤59%) — disertai wajib masuk setiap Sabtu', mandatorySaturday: true },
      { min: 60, max: 84, nominal: 0, label: 'Skor KPI 60–84% — safe zone, tanpa bonus maupun potongan' },
      { min: 85, nominal: 250000, label: 'Bonus KPI Teller Dalam (skor 85% ke atas)' },
    ],
    defaults: DEFAULT_KPI,
    targets: [{ company: ['PTU'], branch: '*', roles: ['Teller Dalam'] }],
    note:
      'Sumber: PUSAT KPI SEMUA_2.xlsx, matriks bonus PTU (ekstraksi-kpi-bonus.md §5). ' +
      'Bonus PTU mulai di 85%, satu titik lebih rendah daripada PVI yang mulai di 86% ' +
      '— beda itu ada di sheet aslinya (masalah #17). Nilai 85 diselesaikan ke band ' +
      'berbonus, sehingga safe zone berhenti di 84%.\n\n' +
      CATATAN_UMUM,
  },

  {
    ruleKey: 'kpi_ptu_teller_luar',
    effectiveFrom: '2020-01-01',
    effectiveTo: null,
    mode: 'agregat',
    sql: KPI_BULANAN_SQL,
    tierField: 'skor_persen',
    guards: guardsKpi(85),
    tiers: [
      { max: 69, nominal: -150000, label: 'Potongan KPI Teller Luar (skor ≤69%) — disertai wajib masuk setiap Sabtu', mandatorySaturday: true },
      { min: 70, max: 84, nominal: 0, label: 'Skor KPI 70–84% — safe zone, tanpa bonus maupun potongan' },
      { min: 85, nominal: 250000, label: 'Bonus KPI Teller Luar (skor 85% ke atas)' },
    ],
    defaults: DEFAULT_KPI,
    targets: [{ company: ['PTU'], branch: '*', roles: ['Teller Luar'] }],
    note:
      'Sumber: PUSAT KPI SEMUA_2.xlsx, matriks bonus PTU (ekstraksi-kpi-bonus.md §5). ' +
      'Nilai 85 diselesaikan ke band berbonus, sama seperti Teller Dalam.\n\n' +
      'CATATAN DATA, bukan soal rule: blok KPI Teller Luar PTU di sheet _2 RUSAK — ' +
      'bobot 0.15 dan 0.10 masuk ke kolom Target dan kolom Weight dibiarkan kosong, ' +
      'sehingga 60% bobot tidak ikut terhitung (masalah #3). Selama itu belum ' +
      'diperbaiki, skor yang masuk ke rule ini terlalu rendah dan potongan bisa jatuh ' +
      'pada orang yang sebenarnya tidak layak dipotong.\n\n' +
      CATATAN_UMUM,
  },
]
