// Inspeksi (read-only): apa saja yang dilihat jabatan bernuansa "Marketing".
import { config } from 'dotenv'
config({ path: '.env.local' })
config()
import { PrismaClient } from '../../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

// --server = pakai PRISMA_DATABASE_URL (DB server), bukan DATABASE_URL lokal.
const CONN = process.argv.includes('--server')
  ? process.env.PRISMA_DATABASE_URL
  : process.env.DATABASE_URL

const pool = new pg.Pool({ connectionString: CONN, max: 3 })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

async function main() {
  console.log('DB host:', (CONN ?? '').replace(/:\/\/[^@]*@/, '://***@'))

  const companies = await prisma.company.findMany({ select: { id: true, name: true } })
  const byId = new Map(companies.map((c) => [c.id, c.name]))

  const roles = await prisma.custom_role.findMany({
    where: { name: { contains: 'marketing', mode: 'insensitive' } },
    select: {
      id: true,
      name: true,
      companyId: true,
      permissions: true,
      usesResourcePerms: true,
      resourcePerms: true,
      _count: { select: { users: true } },
    },
    orderBy: [{ name: 'asc' }],
  })

  for (const r of roles) {
    console.log(
      `\n=== ${r.name} @ ${r.companyId ? byId.get(r.companyId) ?? r.companyId : 'GLOBAL'} ` +
        `(id=${r.id}, users=${r._count.users}, matriks=${r.usesResourcePerms})`
    )
    console.log('  legacy:', r.permissions.sort().join(', ') || '(kosong)')
    for (const g of r.resourcePerms.sort((a, b) => a.resource.localeCompare(b.resource))) {
      console.log(
        `  grant: ${g.resource.padEnd(28)} view=${g.viewScope}${g.viewCompanyIds.length ? `(${g.viewCompanyIds.map((i) => byId.get(i) ?? i).join('|')})` : ''}` +
          ` write=${g.writeScope}${g.writeCompanyIds.length ? `(${g.writeCompanyIds.map((i) => byId.get(i) ?? i).join('|')})` : ''}`
      )
    }
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
