// Mengisi tanggal merah SAJA — tanpa menyentuh apa pun yang lain.
//
// `prisma/seed.ts` tidak aman dijalankan di database yang sudah dipakai (lihat
// seed-payroll-rules.ts): seed penuh menghapus seluruh jabatan beserta
// konfigurasi KPI-nya. Script ini hanya menambah baris PublicHoliday yang
// tanggalnya belum ada, jadi aman dijalankan berulang dan tidak menimpa
// koreksi manual HR.
//
// Jalankan: npx tsx prisma/scripts/seed-public-holidays.ts
import { config } from 'dotenv'
config({ path: '.env.local' })
config()
import { PrismaClient } from '../../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import { seedPublicHolidays } from '../seeds/public-holidays.seeder'

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

  const { host } = new URL(process.env.DATABASE_URL)
  console.log(`Target database: ${host}\n`)

  await seedPublicHolidays(prisma)

  const terisi = await prisma.publicHoliday.findMany({ orderBy: { date: 'asc' } })
  console.log(`\nTotal tanggal merah tersimpan: ${terisi.length}`)
  for (const h of terisi) {
    console.log(`  ${h.date.toISOString().slice(0, 10)}  ${h.name}${h.isJointLeave ? ' (cuti bersama)' : ''}`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
