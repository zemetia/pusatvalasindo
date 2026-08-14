// Mencabut akses Stock & Kas dari seluruh jabatan marketing.
//
// Sasaran:
//   - "Marketing"        → cabut `stockist.daily` (Stock & Kas Harian)
//   - "Kepala Marketing" → cabut `stockist.daily`, `stockist.verify`,
//                          `stock.pt`, `currency`, `currency.stock`,
//                          `currency.price`
//
// Dua lapis dibereskan sekaligus supaya aksesnya tidak hidup lagi lewat pintu
// belakang: baris RoleResourcePermission (gerbang yang benar-benar dipakai
// untuk jabatan `usesResourcePerms`) DAN array `permissions` lama (dipakai
// fallback legacy, dan ditulis ulang oleh seeder/sync).
//
// Aman diulang (idempotent).
//   npx tsx prisma/scripts/revoke-marketing-stock-access.ts --server
//   npx tsx prisma/scripts/revoke-marketing-stock-access.ts --server --apply

import { config } from 'dotenv'
config({ path: '.env.local' })
config()
import { PrismaClient } from '../../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import { writeFileSync } from 'node:fs'
import path from 'node:path'

const BACKUP_PATH = path.join(process.cwd(), 'backup-marketing-stock-access.json')

const APPLY = process.argv.includes('--apply')
// --server = DB server (PRISMA_DATABASE_URL); tanpa flag = DATABASE_URL lokal.
const CONN = process.argv.includes('--server')
  ? process.env.PRISMA_DATABASE_URL
  : process.env.DATABASE_URL

const pool = new pg.Pool({ connectionString: CONN, max: 3 })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

/** Resource yang dicabut, per nama jabatan (dinormalkan huruf kecil). */
const RESOURCES_TO_REVOKE: Record<string, string[]> = {
  marketing: ['stockist.daily'],
  'kepala marketing': [
    'stockist.daily',
    'stockist.verify',
    'stock.pt',
    'currency',
    'currency.stock',
    'currency.price',
  ],
}

/** Permission lama yang dicabut, per nama jabatan. */
const LEGACY_TO_REVOKE: Record<string, string[]> = {
  marketing: ['stockist.view', 'stockist.manage'],
  'kepala marketing': [
    'stockist.view',
    'stockist.manage',
    'stockist.verify',
    'stock.view',
    'stock.manage',
    'company_stock.view',
    'company_stock.manage',
    'currency.view',
    'currency.manage',
  ],
}

async function main() {
  console.log('DB   :', (CONN ?? '').replace(/:\/\/[^@]*@/, '://***@'))
  console.log('Mode :', APPLY ? 'APPLY (menulis)' : 'DRY RUN')

  const backup: unknown[] = []

  const companies = await prisma.company.findMany({ select: { id: true, name: true } })
  const companyName = new Map(companies.map((c) => [c.id, c.name]))

  const roles = await prisma.custom_role.findMany({
    where: { name: { in: ['Marketing', 'Kepala Marketing'], mode: 'insensitive' } },
    select: {
      id: true,
      name: true,
      companyId: true,
      permissions: true,
      resourcePerms: { select: { resource: true } },
      _count: { select: { users: true } },
    },
    orderBy: [{ name: 'asc' }],
  })

  if (roles.length === 0) {
    console.log('\nTidak ada jabatan Marketing / Kepala Marketing di database ini.')
    return
  }

  for (const role of roles) {
    const key = role.name.trim().toLowerCase()
    const resources = RESOURCES_TO_REVOKE[key] ?? []
    const legacy = LEGACY_TO_REVOKE[key] ?? []

    const label = `${role.name} @ ${role.companyId ? companyName.get(role.companyId) ?? role.companyId : 'GLOBAL'}`
    const hitResources = role.resourcePerms
      .map((g) => g.resource)
      .filter((r) => resources.includes(r))
    const hitLegacy = role.permissions.filter((p) => legacy.includes(p))

    console.log(`\n${label} (${role._count.users} user)`)
    console.log(
      `  resource dicabut: ${hitResources.length ? hitResources.join(', ') : '(sudah bersih)'}`
    )
    console.log(`  legacy dicabut  : ${hitLegacy.length ? hitLegacy.join(', ') : '(sudah bersih)'}`)

    if (!APPLY || (hitResources.length === 0 && hitLegacy.length === 0)) continue

    // Simpan keadaan sebelum dicabut supaya bisa dikembalikan tanpa menebak.
    backup.push({
      roleId: role.id,
      name: role.name,
      companyId: role.companyId,
      permissions: role.permissions,
      resourcePerms: await prisma.roleResourcePermission.findMany({
        where: { roleId: role.id, resource: { in: resources } },
      }),
    })

    await prisma.$transaction([
      prisma.roleResourcePermission.deleteMany({
        where: { roleId: role.id, resource: { in: resources } },
      }),
      prisma.custom_role.update({
        where: { id: role.id },
        data: { permissions: role.permissions.filter((p) => !legacy.includes(p)) },
      }),
    ])
  }

  if (APPLY && backup.length) {
    writeFileSync(BACKUP_PATH, JSON.stringify(backup, null, 2))
    console.log(`\nCadangan keadaan lama: ${BACKUP_PATH}`)
  }

  console.log(
    APPLY
      ? '\nSelesai. Pemegang jabatan perlu memuat ulang halaman (sidebar dirender per-request).'
      : '\nDry run selesai. Tambahkan --apply untuk menulis ke database.'
  )
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
