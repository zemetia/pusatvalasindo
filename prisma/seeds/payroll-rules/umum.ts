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
      'SELECT to_char(a.date, \'YYYY-MM-DD\') AS tanggal, GREATEST(0, (EXTRACT(HOUR FROM (a."checkIn" AT TIME ZONE \'Asia/Jakarta\'))::int * 60 + EXTRACT(MINUTE FROM (a."checkIn" AT TIME ZONE \'Asia/Jakarta\'))::int) - (17 * 60 + 40))::int AS menit_telat, (ROW_NUMBER() OVER (ORDER BY a.date))::int AS urutan_pelanggaran FROM hv_attendance a WHERE a.user_id = :employee_id AND a.date BETWEEN :periode_awal AND :periode_akhir AND a.status = \'LATE\' AND a."checkIn" IS NOT NULL ORDER BY a.date',
    tierField: 'urutan_pelanggaran',
    tiers: [
      // NEGATIF — arah uang sekarang milik nominalnya, bukan tipe rule.
      { min: 1, perUnit: -1000, unitField: 'menit_telat', label: 'Denda keterlambatan Rp 1.000 per menit' },
    ],
    defaults: { nominal: 0, label: 'Tidak ada keterlambatan yang berdampak pada gaji' },
    targets: [{ company: '*', branch: '*', roles: '*' }],
    note:
      'Memindahkan potongan keterlambatan yang sebelumnya dihitung langsung di ' +
      'payroll.service.ts ke rule engine. Angkanya SENGAJA sama persis dengan ' +
      'perilaku yang berjalan (Rp 1.000 per menit, dihitung dari jam masuk 17.40 ' +
      'WIB pada hari berstatus LATE), supaya perpindahan ini tidak diam-diam ' +
      'mengubah gaji siapa pun. Jam masuk & toleransi berasal dari ' +
      'src/lib/attendance-rules.ts (WORK_START_HOUR 17, WORK_START_MINUTE 40, tanpa ' +
      'toleransi). Kalau HR ingin denda berjenjang (mis. pelanggaran ke-4 dst. ' +
      'lebih mahal), simpan versi baru dan pecah tier-nya.',
  },
]
