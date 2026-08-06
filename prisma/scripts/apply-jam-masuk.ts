// Menyelaraskan SQL rule `denda_keterlambatan` yang TERSIMPAN DI DATABASE
// dengan jam masuk di src/lib/attendance-time.ts.
//
// KENAPA PERLU SCRIPT TERSENDIRI: mengubah konstanta di attendance-time.ts
// langsung mengubah status LATE, label UI, dan SQL yang di-seed. Tapi rule yang
// SUDAH ada di database tidak ikut berubah — `seed-payroll-rules.ts` sengaja
// melewati ruleKey yang sudah ada, supaya suntingan HR tidak tertimpa. Tanpa
// script ini, server menandai orang terlambat memakai jam baru sementara rule
// mendendakannya memakai jam lama, dan slip menjelaskan denda dengan angka yang
// bukan dasar dendanya.
//
// Versi baru disimpan lewat `saveRuleVersion` — jalur yang sama dengan halaman
// "Rule Reward & Denda" — supaya tanda tangan, urutan versi, dan penutupan masa
// berlaku versi lama semuanya benar. Versi lama TIDAK dihapus: slip bulan-bulan
// sebelumnya harus tetap bisa menjelaskan dirinya dengan jam yang berlaku saat
// itu.
//
// Jalankan: npx tsx prisma/scripts/apply-jam-masuk.ts [--dari YYYY-MM-DD]
import { config } from 'dotenv'
config({ path: '.env.local' })
config()

import { saveRuleVersion } from '../../src/backend/services/payroll-rule.service'
import {
  WORK_START_HOUR,
  WORK_START_LABEL,
  WORK_START_MINUTE,
  workStartSqlExpr,
} from '../../src/lib/attendance-time'
import prisma from '../../src/lib/prisma'

/**
 * Berlaku mulai awal bulan berjalan secara default.
 *
 * Satu bulan gaji harus dihitung dengan satu versi rule dari awal sampai akhir.
 * Kalau versi baru mulai di tengah bulan, hari-hari sebelum tanggal itu jatuh ke
 * versi lama dan bulan yang sama didendakan dengan dua jam masuk berbeda.
 */
function awalBulanIni(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

function argDari(): string {
  const i = process.argv.indexOf('--dari')
  if (i === -1) return awalBulanIni()
  const v = process.argv[i + 1]
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    throw new Error('--dari harus berformat YYYY-MM-DD.')
  }
  return v
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL belum diset — isi .env atau .env.local dulu.')
  }
  if (!process.env.PAYROLL_RULE_SIGNING_KEY) {
    throw new Error(
      'PAYROLL_RULE_SIGNING_KEY belum diset — rule tidak bisa ditandatangani, jadi tidak bisa disimpan.'
    )
  }

  const effectiveFrom = argDari()
  const { host } = new URL(process.env.DATABASE_URL)
  console.log(`Target database : ${host}`)
  console.log(`Jam masuk baru  : ${WORK_START_LABEL} WIB`)
  console.log(`Berlaku mulai   : ${effectiveFrom}\n`)

  // Menit masuk menurut WIB — dipakai dua kali (memilih baris & menghitung
  // nominal), jadi ditulis sekali di sini.
  //
  // DUA `AT TIME ZONE`, dan urutannya menentukan benar-salahnya. `checkIn`
  // bertipe `timestamp WITHOUT time zone` berisi instan UTC polos (00.52 di
  // kolom = 07.52 WIB). `AT TIME ZONE 'Asia/Jakarta'` sendirian akan MENAFSIRKAN
  // nilai itu seolah sudah WIB dan menggesernya ke arah sebaliknya — itu sebabnya
  // jam masuk 07.48 selama ini terbaca 17.48 oleh rule.
  const menitMasuk =
    '(EXTRACT(HOUR FROM (a."checkIn" AT TIME ZONE \'UTC\' AT TIME ZONE \'Asia/Jakarta\'))::int * 60 + ' +
    'EXTRACT(MINUTE FROM (a."checkIn" AT TIME ZONE \'UTC\' AT TIME ZONE \'Asia/Jakarta\'))::int)'

  // Baris yang dihitung terlambat DITURUNKAN dari checkIn, bukan dari kolom
  // status. Kolom itu cuma potret ambang saat presensi dicatat: memakainya
  // sebagai filter berarti ambang LAMA memilih barisnya sementara ambang BARU
  // menghitung nominalnya — dua angka berbeda pada satu baris. Itu yang membuat
  // hari dengan jam masuk 06.56 tetap terpilih lalu didenda 0 menit, sementara
  // hari yang masuk 07.50 tidak pernah terlihat sama sekali.
  //
  // Satu-satunya yang masih bersandar pada kolom status adalah baris TANPA jam
  // masuk — hari yang di-set manual oleh HR. Itu keputusan manusia, bukan hasil
  // pembacaan jam, jadi tetap dihitung sebagai satu pelanggaran dengan 0 menit.
  const telat =
    `(a."checkIn" IS NOT NULL AND ${menitMasuk} > ${workStartSqlExpr()}) ` +
    `OR (a."checkIn" IS NULL AND a.status = 'LATE')`

  const sql =
    'SELECT to_char(a.date, \'YYYY-MM-DD\') AS tanggal, ' +
    `CASE WHEN a."checkIn" IS NULL THEN 0 ELSE GREATEST(0, ${menitMasuk} - ${workStartSqlExpr()}) END::int AS menit_telat, ` +
    '(ROW_NUMBER() OVER (ORDER BY a.date))::int AS urutan_pelanggaran ' +
    'FROM hv_attendance a WHERE a.user_id = :employee_id AND a.date BETWEEN :periode_awal AND :periode_akhir ' +
    `AND (${telat}) ORDER BY a.date`

  // Ambang di DALAM database ikut diselaraskan. View hv_attendance_monthly dan
  // hv_payroll_monthly menghitung late_days lewat hv_is_late(), yang membaca
  // fungsi ini — tanpa langkah ini, dashboard dan KPI akan memakai jam masuk
  // lama sementara rule denda memakai yang baru.
  await prisma.$executeRawUnsafe(
    `CREATE OR REPLACE FUNCTION hv_work_start_minutes() RETURNS integer ` +
      `LANGUAGE sql IMMUTABLE AS $fn$ SELECT ${WORK_START_HOUR} * 60 + ${WORK_START_MINUTE} $fn$;`
  )
  console.log(`✓ hv_work_start_minutes() diselaraskan ke ${WORK_START_LABEL} WIB`)

  const created = await saveRuleVersion(
    {
      ruleKey: 'denda_keterlambatan',
      effectiveFrom,
      effectiveTo: null,
      mode: 'PER_BARIS',
      sql,
      tierField: 'urutan_pelanggaran',
      constants: null,
      guards: null,
      defaults: { nominal: 0, label: 'Tidak ada keterlambatan yang berdampak pada gaji' },
      targets: [{ company: '*', branch: '*', roles: '*' }],
      excepts: null,
      note:
        `Jam masuk ${WORK_START_LABEL} WIB (tanpa toleransi), mengikuti ` +
        'src/lib/attendance-time.ts. Keterlambatan sekarang DITURUNKAN dari ' +
        'checkIn, bukan dari kolom status — sebelumnya WHERE menyaring dengan ' +
        "status = 'LATE', yaitu potret ambang saat baris dicatat, sehingga hari " +
        'dengan jam masuk 06.56 tetap terpilih (lalu didenda 0 menit) sementara ' +
        'hari yang masuk 07.50 tidak pernah ikut terhitung. Hari LATE tanpa jam ' +
        'checkIn — yang di-set manual HR — tetap dihitung sebagai satu ' +
        'pelanggaran dengan 0 menit. Tingkatan denda tidak berubah: pelanggaran ' +
        'ke-1 s/d ke-3 Rp 1.000/menit, ke-4 dst. Rp 2.000/menit, dihitung ulang ' +
        'tiap bulan.',
      changeNote: `Jam masuk ${WORK_START_LABEL} WIB + telat diturunkan dari checkIn, bukan kolom status.`,
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
