// Memperbaiki SQL rule `denda_keterlambatan` yang TERSIMPAN DI DATABASE —
// SEMUA versinya, di tempat, tanpa membuat versi baru.
//
// KENAPA MENIMPA, BUKAN MENAMBAH VERSI. Perbaikan jam masuk (07.40) dan
// derivasi telat dari `checkIn` selama ini cuma hidup di dua tempat yang tidak
// pernah menyentuh database ini: benih `prisma/seeds/payroll-rules/umum.ts`
// (seeder sengaja melewati ruleKey yang sudah ada) dan
// `prisma/scripts/apply-jam-masuk.ts` (tidak pernah dijalankan). Akibatnya rule
// yang benar-benar dipakai menghitung gaji masih memuat tiga cacat sekaligus:
//
//   1. `AT TIME ZONE 'Asia/Jakarta'` satu tahap atas kolom `timestamp WITHOUT
//      time zone` yang berisi instan UTC polos — jam masuk tergeser 7 jam.
//   2. Ambang 17.40, sisa dari sebelum jam masuk ditetapkan 07.40.
//   3. `WHERE a.status = 'LATE'` — kolom status cuma potret ambang saat baris
//      dicatat, jadi ambang LAMA memilih barisnya sementara ambang BARU
//      menghitung nominalnya.
//
// Gabungan ketiganya membuat Juli 2026 menghasilkan SATU baris denda bernilai
// nol untuk seluruh perusahaan, padahal ada 75 hari keterlambatan sungguhan.
//
// `saveRuleVersion` tidak bisa dipakai: ia hanya menerima versi baru yang mulai
// berlaku SESUDAH versi terakhir (1 Agustus 2026), sehingga Juli — bulan gaji
// yang sedang dihitung — akan tetap memakai SQL yang salah. Yang diperbaiki di
// sini bukan kebijakan, melainkan query yang tidak pernah menghitung WIB dengan
// benar; tidak ada perhitungan sah masa lalu yang hilang karenanya. Tarif,
// tingkatan, masa berlaku, dan nomor versi TIDAK disentuh.
//
// Tanda tangan tiap baris dihitung ulang — tanpa itu engine menolak rule-nya.
//
// Jalankan:
//   npx tsx prisma/scripts/repair-denda-keterlambatan-sql.ts           (pratinjau)
//   npx tsx prisma/scripts/repair-denda-keterlambatan-sql.ts --apply   (menulis)
import { config } from 'dotenv'
config({ path: '.env.local' })
config()

import { PrismaClient } from '../../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import { signRule } from '../../src/backend/payroll-rules/signature'
import {
  WORK_START_HOUR,
  WORK_START_LABEL,
  WORK_START_MINUTE,
  workStartSqlExpr,
} from '../../src/lib/attendance-time'

// Client dibuat di sini, bukan diimpor dari src/lib/prisma: modul itu membaca
// DATABASE_URL saat diimpor, dan import ESM dieksekusi SEBELUM `config()` di
// atas sempat jalan — hasilnya koneksi tanpa password.
const prisma = new PrismaClient({
  adapter: new PrismaPg(
    new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 3, connectionTimeoutMillis: 10_000 })
  ),
})

const RULE_KEY = 'denda_keterlambatan'

/**
 * Menit-dalam-hari jam masuk menurut WIB.
 *
 * DUA `AT TIME ZONE`, dan urutannya menentukan benar-salahnya: `'UTC'` lebih
 * dulu menyatakan bahwa nilai naive itu UTC, barulah `'Asia/Jakarta'`
 * mengubahnya ke WIB.
 */
const MENIT_MASUK =
  '(EXTRACT(HOUR FROM (a."checkIn" AT TIME ZONE \'UTC\' AT TIME ZONE \'Asia/Jakarta\'))::int * 60 + ' +
  'EXTRACT(MINUTE FROM (a."checkIn" AT TIME ZONE \'UTC\' AT TIME ZONE \'Asia/Jakarta\'))::int)'

/**
 * Telat diturunkan dari `checkIn`. Yang masih bersandar pada kolom status
 * hanyalah baris TANPA jam masuk — hari yang di-set manual oleh HR. Itu
 * keputusan manusia, bukan pembacaan jam, jadi tetap dihitung satu pelanggaran
 * dengan 0 menit.
 */
const TELAT =
  `(a."checkIn" IS NOT NULL AND ${MENIT_MASUK} > ${workStartSqlExpr()}) ` +
  `OR (a."checkIn" IS NULL AND a.status = 'LATE')`

const SQL_BENAR =
  'SELECT to_char(a.date, \'YYYY-MM-DD\') AS tanggal, ' +
  `CASE WHEN a."checkIn" IS NULL THEN 0 ELSE GREATEST(0, ${MENIT_MASUK} - ${workStartSqlExpr()}) END::int AS menit_telat, ` +
  '(ROW_NUMBER() OVER (ORDER BY a.date))::int AS urutan_pelanggaran ' +
  'FROM hv_attendance a WHERE a.user_id = :employee_id AND a.date BETWEEN :periode_awal AND :periode_akhir ' +
  `AND (${TELAT}) ORDER BY a.date`

const CHANGE_NOTE =
  `SQL diperbaiki di tempat: jam masuk ${WORK_START_LABEL} WIB, dua tahap ` +
  'AT TIME ZONE (UTC → Asia/Jakarta), dan telat diturunkan dari checkIn ' +
  'alih-alih kolom status. Tarif, tingkatan, dan masa berlaku tidak berubah.'

async function main() {
  const apply = process.argv.includes('--apply')

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL belum diset — isi .env atau .env.local dulu.')
  }
  if (!process.env.PAYROLL_RULE_SIGNING_KEY) {
    throw new Error(
      'PAYROLL_RULE_SIGNING_KEY belum diset — rule tidak bisa ditandatangani, jadi tidak bisa disimpan.'
    )
  }

  const { host } = new URL(process.env.DATABASE_URL)
  console.log(`Target database : ${host}`)
  console.log(`Jam masuk       : ${WORK_START_LABEL} WIB`)
  console.log(`Mode            : ${apply ? 'MENULIS (--apply)' : 'PRATINJAU (tanpa --apply)'}\n`)

  const versions = await prisma.payrollRule.findMany({
    where: { ruleKey: RULE_KEY },
    orderBy: { version: 'asc' },
    include: { tiers: { orderBy: { sortOrder: 'asc' } } },
  })

  if (versions.length === 0) {
    throw new Error(`Rule ${RULE_KEY} tidak ada di database ini.`)
  }

  for (const v of versions) {
    const range =
      `${v.effectiveFrom.toISOString().slice(0, 10)} .. ` +
      (v.effectiveTo ? v.effectiveTo.toISOString().slice(0, 10) : 'sekarang')

    if (v.sql.trim() === SQL_BENAR.trim()) {
      console.log(`v${v.version} (${range}) — SQL sudah benar, dilewati.`)
      continue
    }

    console.log(`v${v.version} (${range})`)
    console.log(`  lama : ${v.sql.slice(0, 120)}…`)
    console.log(`  baru : ${SQL_BENAR.slice(0, 120)}…`)

    if (!apply) {
      console.log('  → belum ditulis (jalankan ulang dengan --apply)\n')
      continue
    }

    const signature = signRule({
      ruleKey: v.ruleKey,
      version: v.version,
      effectiveFrom: v.effectiveFrom,
      effectiveTo: v.effectiveTo,
      mode: v.mode,
      sql: SQL_BENAR,
      tierField: v.tierField,
      constants: v.constants,
      guards: v.guards,
      defaults: v.defaults,
      targets: v.targets,
      excepts: v.excepts,
      tiers: v.tiers,
    })

    await prisma.payrollRule.update({
      where: { id: v.id },
      data: { sql: SQL_BENAR, signature, changeNote: CHANGE_NOTE },
    })
    console.log('  ✓ ditulis & ditandatangani ulang\n')
  }

  // Ambang di DALAM database ikut diselaraskan: view hv_attendance_monthly dan
  // hv_payroll_monthly menghitung late_days lewat hv_is_late(), yang membaca
  // fungsi ini. Tanpa langkah ini dashboard memakai jam masuk lama sementara
  // rule denda memakai yang baru.
  if (apply) {
    await prisma.$executeRawUnsafe(
      `CREATE OR REPLACE FUNCTION hv_work_start_minutes() RETURNS integer ` +
        `LANGUAGE sql IMMUTABLE AS $fn$ SELECT ${WORK_START_HOUR} * 60 + ${WORK_START_MINUTE} $fn$;`
    )
    console.log(`✓ hv_work_start_minutes() diselaraskan ke ${WORK_START_LABEL} WIB`)
    console.log(
      '\nLangkah terakhir ada di aplikasi: slip yang sudah terlanjur dihitung ' +
        'harus di-Hitung Ulang supaya memakai SQL yang baru.'
    )
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
