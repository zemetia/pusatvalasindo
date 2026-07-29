// Ad-hoc sync: refresh `custom_role.permissions` for every existing role row
// from the current lib/permissions.ts definitions, without deleting or
// reseeding anything else. Fixes drift when new PERMISSIONS are added to code
// but existing DB rows (seeded earlier) never get the new strings.
import { config } from 'dotenv'
config({ path: '.env.local' })
config()
import { PrismaClient } from '../../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import { getPermissionsForRole } from '../../src/lib/permissions'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 3 })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  const roles = await prisma.custom_role.findMany({
    select: { id: true, name: true, companyId: true, permissions: true },
  })

  for (const role of roles) {
    const newPermissions = getPermissionsForRole(role.name)
    const oldSet = new Set<string>(role.permissions)
    const newSet = new Set<string>(newPermissions)
    const added = newPermissions.filter((p) => !oldSet.has(p))
    const removed = role.permissions.filter((p) => !newSet.has(p))

    if (added.length === 0 && removed.length === 0) continue

    await prisma.custom_role.update({
      where: { id: role.id },
      data: { permissions: newPermissions },
    })
    console.log(
      `  ✓ ${role.name} (${role.companyId ?? 'GLOBAL'}) +[${added.join(', ')}] -[${removed.join(', ')}]`
    )
  }

  console.log('Done.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
