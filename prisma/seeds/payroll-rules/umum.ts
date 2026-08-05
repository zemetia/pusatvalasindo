// LINTAS PT — rule yang berlaku untuk semua perusahaan — rule reward/denda slip gaji.
//
// Benih untuk tabel PayrollRule + PayrollRuleTier. Angka dan SQL di sini hanya
// dipakai saat rule dengan ruleKey yang sama BELUM ada di database; sesudahnya
// HR menyunting lewat halaman "Rule Reward & Denda" dan file ini tidak lagi
// berpengaruh. Acuan field: docs/tasks/spesifikasi-rule-slip-gaji.md

import type { RuleSeed } from './types'

export const UMUM_RULES: RuleSeed[] = [
  {
    ruleKey: 'denda_keterlambatan',
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    mode: 'per_baris',
    sql:
      'SELECT to_char(a.date, \'YYYY-MM-DD\') AS tanggal, ' +
      'CASE WHEN a."checkIn" IS NULL THEN 0 ELSE GREATEST(0, (EXTRACT(HOUR FROM (a."checkIn" AT TIME ZONE \'Asia/Jakarta\'))::int * 60 + EXTRACT(MINUTE FROM (a."checkIn" AT TIME ZONE \'Asia/Jakarta\'))::int) - (17 * 60 + 40)) END::int AS menit_telat, ' +
      '(ROW_NUMBER() OVER (ORDER BY a.date))::int AS urutan_pelanggaran ' +
      'FROM hv_attendance a WHERE a.user_id = :employee_id AND a.date BETWEEN :periode_awal AND :periode_akhir AND a.status = \'LATE\' ORDER BY a.date',
    tierField: 'urutan_pelanggaran',
    tiers: [
      // NEGATIF — arah uang sekarang milik nominalnya, bukan tipe rule.
      // Berjenjang PER BULAN: urutan_pelanggaran dihitung ulang tiap periode
      // (query dibatasi periode_awal..periode_akhir), jadi "ke-1 s/d ke-3"
      // selalu berarti dalam bulan berjalan, bukan akumulasi sepanjang waktu.
      { min: 1, max: 3, perUnit: -1000, unitField: 'menit_telat', label: 'Denda keterlambatan Rp 1.000 per menit (pelanggaran ke-1 s/d ke-3 bulan ini)' },
      { min: 4, perUnit: -2000, unitField: 'menit_telat', label: 'Denda keterlambatan Rp 2.000 per menit (pelanggaran ke-4 dst. bulan ini)' },
    ],
    defaults: { nominal: 0, label: 'Tidak ada keterlambatan yang berdampak pada gaji' },
    targets: [{ company: '*', branch: '*', roles: '*' }],
    note:
      'Memindahkan potongan keterlambatan yang sebelumnya dihitung langsung di ' +
      'payroll.service.ts ke rule engine, lalu dijadikan berjenjang per bulan: ' +
      'Rp 1.000/menit untuk pelanggaran ke-1 s/d ke-3, Rp 2.000/menit untuk ke-4 ' +
      'dst. Jam masuk & toleransi berasal dari src/lib/attendance-rules.ts ' +
      '(WORK_START_HOUR 17, WORK_START_MINUTE 40, tanpa toleransi). Hari berstatus ' +
      'LATE tanpa jam checkIn (mis. diset manual oleh HR lewat halaman kelola ' +
      'presensi tanpa mengisi jam masuk) tetap dihitung sebagai satu pelanggaran ' +
      '(0 menit, jadi tidak menambah rupiah) supaya tidak lolos diam-diam dari ' +
      'penghitung urutan pelanggaran bulanan — sebelumnya baris begini disaring ' +
      'total lewat "checkIn IS NOT NULL" di WHERE, sehingga tidak ikut dihitung ' +
      'sama sekali, bahkan untuk menentukan pelanggaran keberapa hari-hari lain.',
  },
]
