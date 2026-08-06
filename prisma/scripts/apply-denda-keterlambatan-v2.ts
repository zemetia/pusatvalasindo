// Menaikkan rule `denda_keterlambatan` ke versi baru: denda berjenjang per
// bulan (Rp 1.000/menit untuk pelanggaran ke-1 s/d ke-3, Rp 2.000/menit untuk
// ke-4 dst.) dan menghitung hari LATE yang di-set manual tanpa checkIn sebagai
// satu pelanggaran (0 menit, jadi tidak menambah rupiah, tapi tetap menaikkan
// urutan pelanggaran bulan itu).
//
// Rule ini SUDAH ada di database (bukan database kosong), jadi
// `seed-payroll-rules.ts` tidak akan menyentuhnya — seeder itu sengaja
// melewati ruleKey yang sudah ada. Menyimpan versi baru harus lewat
// `saveRuleVersion`, sama seperti yang dipakai halaman "Rule Reward & Denda",
// supaya tanda tangan, urutan versi, dan penutupan masa berlaku versi lama
// semuanya benar.
//
// SUDAH DIJALANKAN — JANGAN DIJALANKAN LAGI. Script ini disimpan sebagai
// catatan perubahan yang pernah diterapkan. SQL di dalamnya masih memakai jam
// masuk lama (17.40) yang ditulis tangan, jadi menjalankannya sekarang akan
// menyimpan versi baru yang MENGEMBALIKAN jam masuk ke 17.40 dan membatalkan
// 07.40 yang berlaku. Untuk menyelaraskan jam masuk, pakai
// prisma/scripts/apply-jam-masuk.ts — SQL-nya diturunkan dari
// src/lib/attendance-time.ts, jadi tidak bisa menyimpang.
//
// Jalankan sekali: npx tsx prisma/scripts/apply-denda-keterlambatan-v2.ts
import { config } from 'dotenv'
config({ path: '.env.local' })
config()

import { saveRuleVersion } from '../../src/backend/services/payroll-rule.service'
import prisma from '../../src/lib/prisma'

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL belum diset — isi .env atau .env.local dulu.')
  }
  if (!process.env.PAYROLL_RULE_SIGNING_KEY) {
    throw new Error(
      'PAYROLL_RULE_SIGNING_KEY belum diset — rule tidak bisa ditandatangani, jadi tidak bisa disimpan.'
    )
  }

  const { host } = new URL(process.env.DATABASE_URL)
  console.log(`Target database: ${host}\n`)

  const created = await saveRuleVersion(
    {
      ruleKey: 'denda_keterlambatan',
      // Mulai dari awal periode gaji bulan berjalan, supaya satu bulan penuh
      // dihitung dengan satu versi rule yang sama — tidak terpotong di
      // tengah bulan. Sesuaikan tanggal ini kalau dijalankan di bulan lain.
      effectiveFrom: '2026-08-01',
      effectiveTo: null,
      mode: 'PER_BARIS',
      sql:
        'SELECT to_char(a.date, \'YYYY-MM-DD\') AS tanggal, ' +
        'CASE WHEN a."checkIn" IS NULL THEN 0 ELSE GREATEST(0, (EXTRACT(HOUR FROM (a."checkIn" AT TIME ZONE \'Asia/Jakarta\'))::int * 60 + EXTRACT(MINUTE FROM (a."checkIn" AT TIME ZONE \'Asia/Jakarta\'))::int) - (17 * 60 + 40)) END::int AS menit_telat, ' +
        '(ROW_NUMBER() OVER (ORDER BY a.date))::int AS urutan_pelanggaran ' +
        'FROM hv_attendance a WHERE a.user_id = :employee_id AND a.date BETWEEN :periode_awal AND :periode_akhir AND a.status = \'LATE\' ORDER BY a.date',
      tierField: 'urutan_pelanggaran',
      constants: null,
      guards: null,
      defaults: { nominal: 0, label: 'Tidak ada keterlambatan yang berdampak pada gaji' },
      targets: [{ company: '*', branch: '*', roles: '*' }],
      excepts: null,
      note:
        'v2: denda berjenjang per bulan — pelanggaran ke-1 s/d ke-3 tetap Rp ' +
        '1.000/menit, ke-4 dst. naik jadi Rp 2.000/menit (urutan dihitung ulang ' +
        'tiap bulan karena query dibatasi periode_awal..periode_akhir, jadi ' +
        'bukan akumulasi lintas bulan). Juga menghapus syarat checkIn IS NOT ' +
        'NULL dari WHERE: hari LATE yang di-set manual oleh HR tanpa jam masuk ' +
        'sekarang tetap dihitung sebagai satu pelanggaran (0 menit → tidak ada ' +
        'rupiah) supaya tidak lolos diam-diam dari penghitung urutan ' +
        'pelanggaran bulanan.',
      changeNote:
        'Denda keterlambatan berjenjang (3x pertama Rp1.000/menit, ke-4 dst. Rp2.000/menit, per bulan) + hitung hari LATE manual tanpa checkIn.',
      tiers: [
        {
          min: 1,
          max: 3,
          nominal: null,
          perUnit: -1000,
          unitField: 'menit_telat',
          formula: null,
          label: 'Denda keterlambatan Rp 1.000/menit (pelanggaran ke-1 s/d ke-3 bulan ini)',
        },
        {
          min: 4,
          max: null,
          nominal: null,
          perUnit: -2000,
          unitField: 'menit_telat',
          formula: null,
          label: 'Denda keterlambatan Rp 2.000/menit (pelanggaran ke-4 dst. bulan ini)',
        },
      ],
    },
    { userId: null, canEditSql: true }
  )

  console.log(
    `✓ Tersimpan: ${created.ruleKey}@v${created.version}, berlaku mulai ` +
      `${created.effectiveFrom.toISOString().slice(0, 10)}`
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
