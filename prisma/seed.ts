// Prioritas sama dengan Next.js: .env.local > .env
import { config } from 'dotenv'
config({ path: '.env.local' })
config()
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import { seedCurrencies } from './seeds/currencies.seeder'
import { seedCompanies } from './seeds/companies.seeder'
import { seedBranches } from './seeds/branches.seeder'
import { seedStockItems } from './seeds/stock-items.seeder'
import { seedCompanyStockItems } from './seeds/company-stock-items.seeder'
import { seedBankAccounts } from './seeds/bank-accounts.seeder'
import { seedStockistPockets } from './seeds/stockist-pockets.seeder'
import { seedKasPockets } from './seeds/kas-pockets.seeder'
import { seedKpi } from './seeds/kpi/kpi.seeder'
import { seedRoleKpis } from './seeds/role-kpi/role-kpi.seeder'
import { seedPayrollRules } from './seeds/payroll-rules/payroll-rules.seeder'
import { seedUsers } from './seeds/users/users.seeder'
import { seedPriceBenchmarks } from './seeds/price-benchmarks.seeder'
import { seedRoles } from './seeds/roles.seeder'

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
  idleTimeoutMillis: 60_000,
  connectionTimeoutMillis: 10_000,
  keepAlive: true,
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🌱 Seeding database...')

  const { idrId } = await seedCurrencies(prisma)

  console.log('🌱 Seeding companies...')
  const companyIds = await seedCompanies(prisma)

  console.log('🌱 Seeding custom roles from Excel...')
  await seedRoles(prisma, companyIds)

  console.log('🌱 Seeding branches...')
  const branchIds = await seedBranches(prisma, companyIds)

  console.log('🌱 Seeding stock items...')
  await seedStockItems(prisma, branchIds)

  console.log('🌱 Seeding company stock items (mata uang & logam mulia per PT)...')
  await seedCompanyStockItems(prisma, companyIds)

  console.log('🌱 Seeding bank accounts...')
  await seedBankAccounts(prisma, companyIds, idrId)

  console.log('🌱 Seeding stockist pockets...')
  await seedStockistPockets(prisma, companyIds)

  console.log('🌱 Seeding kas pockets...')
  await seedKasPockets(prisma, companyIds)

  console.log('🌱 Seeding KPI definitions...')
  await seedKpi(prisma)
  await seedRoleKpis(prisma, companyIds)

  console.log('🌱 Seeding matriks insentif payroll...')

  console.log('🌱 Seeding rule reward/denda slip gaji...')
  await seedPayrollRules(prisma)

  console.log('🌱 Seeding patokan harga (penyesuaian jual/beli)...')
  await seedPriceBenchmarks(prisma)

  console.log('🌱 Seeding users...')
  await seedUsers(prisma, companyIds, branchIds)

  console.log('✅ Seeding complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
