// PT PUSAT KIRIM DUIT — rule reward/denda slip gaji.
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
  'kpi-source.ts. Sanksi non-moneter (wajib masuk Sabtu, SP) dibawa terpisah ' +
  'dari nominal lewat mandatorySaturday/warningLetter.'

export const PKD_RULES: RuleSeed[] = [
  {
    ruleKey: 'kpi_pkd_kepala_cabang',
    effectiveFrom: '2020-01-01',
    effectiveTo: null,
    mode: 'agregat',
    sql: KPI_BULANAN_SQL,
    tierField: 'skor_persen',
    guards: guardsKpi(86),
    tiers: [
      { max: 74, nominal: -300000, label: 'Potongan KPI Kepala Cabang (skor ≤74%) — disertai SP', warningLetter: true },
      { min: 75, max: 85, nominal: 0, label: 'Skor KPI 75–85% — safe zone, tanpa bonus maupun potongan' },
      { min: 86, max: 99, nominal: 500000, label: 'Bonus KPI Kepala Cabang (skor 86–99%)' },
      { min: 100, max: 120, nominal: 1000000, label: 'Bonus KPI Kepala Cabang (skor 100–120%)' },
      { min: 121, nominal: 1500000, label: 'Bonus KPI Kepala Cabang (skor di atas 120%)' },
    ],
    defaults: DEFAULT_KPI,
    targets: [{ company: ['PKD'], branch: '*', roles: ['Kepala Cabang'] }],
    note:
      'Sumber: PUSAT KPI SEMUA_2.xlsx :: PKD!A34:C38 (ekstraksi-kpi-bonus.md §5). ' +
      'Sheet menulis band "86%-100%" dan "100%-120%" — nilai 100 diklaim dua band. ' +
      'Diselesaikan ke arah yang menguntungkan karyawan: 100% membayar Rp 1.000.000, ' +
      'sehingga band di bawahnya menjadi 86–99%.\n\n' +
      'Blok KPI yang dinilai berlabel "Team leader PTU" di PKD!A16 — itu salah salin, ' +
      'isinya milik PKD (lihat docs/rules/pkd.md). Potongan Rp 300.000 + SP untuk skor ' +
      '≤74% dulu berdiri sebagai rule `denda_kpi_pkd_kepala_cabang`; sekarang menjadi ' +
      'tier bernominal negatif di rule yang sama.\n\n' +
      CATATAN_UMUM,
  },

  {
    ruleKey: 'kpi_pkd_marketing',
    effectiveFrom: '2020-01-01',
    effectiveTo: null,
    mode: 'agregat',
    sql: KPI_BULANAN_SQL,
    tierField: 'skor_persen',
    guards: guardsKpi(86),
    tiers: [
      { max: 75, nominal: 0, label: 'Skor KPI ≤75% — tanpa bonus, sanksi wajib masuk setiap Sabtu', mandatorySaturday: true },
      { min: 76, max: 85, nominal: 0, label: 'Skor KPI 76–85% — safe zone, tanpa bonus maupun potongan' },
      { min: 86, nominal: 250000, label: 'Bonus KPI Marketing (skor 86% ke atas)' },
    ],
    defaults: DEFAULT_KPI,
    targets: [{ company: ['PKD'], branch: '*', roles: ['Marketing'] }],
    note:
      'Sumber: PUSAT KPI SEMUA_2.xlsx :: PKD!A30:C32 (ekstraksi-kpi-bonus.md §5). ' +
      'Setara PKD-D2 di docs/rules/pkd.md.\n\n' +
      'Band teratas dibuat TANPA batas atas. Sheet berhenti di 100% dan ini bukan ' +
      'kasus hipotetis: skor Juni 2026 108% dan Juli 2026 144% keduanya jatuh di luar ' +
      'matriks. Sebelumnya skor 101%+ ditandai butuh_review dan bonusnya menggantung ' +
      'menunggu keputusan HR per kasus — sekarang dibayar pada nominal band tertinggi ' +
      'yang tertulis. Perlu diingat skor 144% itu sendiri sebagian buatan: bobot sales ' +
      'PKD berjumlah 1.10 alih-alih 1.00 dan %Ach omzet tidak di-cap (masalah #2 dan ' +
      '#5) — yang perlu diperbaiki di modul KPI, bukan di rule ini.\n\n' +
      'Bonus tertulis "PER ORANG" padahal omzet belum dipecah per admin (kolom ' +
      'VINNY/NADINE kosong di "target rekap PKD"!B5:B6), jadi kedua pemegang jabatan ' +
      'akan selalu bernilai sama.\n\n' +
      CATATAN_UMUM,
  },
]
