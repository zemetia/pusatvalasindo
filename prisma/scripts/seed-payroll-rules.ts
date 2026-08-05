// Mengisi rule reward/denda slip gaji SAJA — tanpa menyentuh apa pun yang lain.
//
// Ini ada karena `prisma/seed.ts` TIDAK AMAN dijalankan di production. Seed
// lengkap memanggil `seedRoles`, yang diawali:
//
//     await prisma.roleKpi.deleteMany()
//     await prisma.custom_role.deleteMany()
//
// Di database yang sudah dipakai, itu menghapus seluruh jabatan beserta
// konfigurasi KPI per jabatan — dan `user.customRoleId` ikut kehilangan
// acuannya. Sesudah migrasi 20260805030000 mengosongkan PayrollRule,
// satu-satunya yang perlu diisi ulang adalah rule-nya; menjalankan seed penuh
// untuk itu berarti merusak data yang sama sekali tidak ada hubungannya.
//
// Seeder yang dipanggil di sini SENGAJA hanya membuat rule yang `ruleKey`-nya
// belum ada, jadi menjalankan ulang script ini aman: rule yang sudah disunting
// HR lewat halaman "Rule Reward & Denda" tidak akan ditimpa.
//
// Jalankan: npx tsx prisma/scripts/seed-payroll-rules.ts
import { config } from 'dotenv'
config({ path: '.env.local' })
config()
import { PrismaClient } from '../../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import { seedPayrollRules } from '../seeds/payroll-rules/payroll-rules.seeder'

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
  connectionTimeoutMillis: 10_000,
})
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL belum diset — isi .env atau .env.local dulu.')
  }

  // Seeder memang sudah memperingatkan kalau kunci kosong, tapi peringatan itu
  // mudah terlewat di antara keluaran lain — dan akibatnya diam: nol rule
  // dibuat, payroll berjalan tanpa bonus maupun denda sama sekali. Lebih baik
  // berhenti di sini.
  if (!process.env.PAYROLL_RULE_SIGNING_KEY) {
    throw new Error(
      'PAYROLL_RULE_SIGNING_KEY belum diset. Tanpa kunci itu rule tidak bisa ' +
        'ditandatangani, dan rule tanpa tanda tangan DITOLAK engine — jadi seed ' +
        'akan menghasilkan nol rule tanpa ada yang gagal secara jelas.'
    )
  }

  const { host } = new URL(process.env.DATABASE_URL)
  console.log(`Target database: ${host}\n`)

  await seedPayrollRules(prisma)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
