// Runner mandiri untuk seed patokan harga saja — dipakai saat mengisi DB yang
// sudah berjalan tanpa menjalankan seluruh prisma/seed.ts.
//
//   tsx prisma/seed-price-benchmarks.ts                  -> DATABASE_URL
//   SEED_DATABASE_URL=<url> tsx prisma/seed-price-benchmarks.ts  -> DB lain
import { config } from 'dotenv'
config({ path: '.env.local' })
config()
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import { seedPriceBenchmarks } from './seeds/price-benchmarks.seeder'

const connectionString = process.env.SEED_DATABASE_URL || process.env.DATABASE_URL
if (!connectionString) {
  console.error('DATABASE_URL / SEED_DATABASE_URL tidak diset.')
  process.exit(1)
}

const pool = new pg.Pool({ connectionString, max: 3, connectionTimeoutMillis: 10_000 })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

async function main() {
  const host = new URL(connectionString!).host
  console.log(`🌱 Seeding patokan harga ke ${host}...`)
  await seedPriceBenchmarks(prisma)
  console.log('✅ Selesai.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
