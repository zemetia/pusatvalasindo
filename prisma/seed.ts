// Prioritas sama dengan Next.js: .env.local > .env
import { config } from 'dotenv'
config({ path: '.env.local' })
config()
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import { seedCurrencies } from './seeds/currencies'
import { seedCompanies } from './seeds/companies'
import { seedBranches } from './seeds/branches'
import { seedStockItems } from './seeds/stock-items'
import { seedBankAccounts } from './seeds/bank-accounts'
import { seedKpi } from './seeds/kpi'
import { seedRoleKpis } from './seeds/role-kpi'
import { seedUsers } from './seeds/users'
import { seedRoles } from './seeds/roles'

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

  console.log('🌱 Seeding bank accounts...')
  await seedBankAccounts(prisma, branchIds, idrId)

  console.log('🌱 Seeding KPI definitions...')
  await seedKpi(prisma, companyIds)
  await seedRoleKpis(prisma, companyIds)

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
