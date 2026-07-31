// Backfill: menerjemahkan `custom_role.permissions` (model lama, flat) menjadi
// baris RoleResourcePermission (model baru, per-resource + scope PT).
//
// Terjemahannya PERSIS mempertahankan perilaku lama: izin lama tidak mengenal
// dimensi PT, jadi setiap izin yang dimiliki dipetakan ke scope OWN — yaitu PT
// jabatan itu sendiri. Tidak ada satu pun jabatan yang mendapat akses lebih
// luas dari sebelumnya. Setelah itu barulah admin melebarkan scope lewat UI.
//
// Aman diulang (idempotent). Jalankan setelah migrasi:
//   npx tsx prisma/scripts/backfill-resource-permissions.ts
//   npx tsx prisma/scripts/backfill-resource-permissions.ts --apply   (menulis)
//
// Tanpa --apply, script hanya menampilkan rencana (dry run).

import { config } from 'dotenv'
config({ path: '.env.local' })
config()
import { PrismaClient } from '../../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import { RESOURCES } from '../../src/lib/authz/resources'
import { isGlobalRole } from '../../src/lib/permissions'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 3 })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const APPLY = process.argv.includes('--apply')

type Grant = {
  resource: string
  viewScope: 'NONE' | 'OWN' | 'SELECTED' | 'ALL'
  viewCompanyIds: string[]
  writeScope: 'NONE' | 'OWN' | 'SELECTED' | 'ALL'
  writeCompanyIds: string[]
}

function grantsFor(permissions: string[], roleName: string): Grant[] {
  // Role global tidak perlu baris sama sekali — isGlobalRole di resolve.ts
  // sudah memberi ALL untuk setiap resource, dan itu jaring pengaman yang
  // disengaja supaya salah konfigurasi tidak mengunci semua orang keluar.
  if (isGlobalRole(roleName)) return []

  const out: Grant[] = []
  for (const def of RESOURCES) {
    const hasView = def.legacy?.view ? permissions.includes(def.legacy.view) : false
    const hasWrite = def.legacy?.write ? permissions.includes(def.legacy.write) : false
    if (!hasView && !hasWrite) continue

    // Resource "self" hanya punya satu sumbu — UI Jabatan merendernya sebagai
    // satu sakelar "Akses". Menurunkan writeScope dari `legacy.write` untuk
    // resource semacam ini menghasilkan baris yang tampak hidup tapi menolak
    // setiap aksi: model lama tidak punya permission "boleh clock-in", jadi
    // `attendance.self` selalu keluar dengan writeScope NONE.
    const single = def.scoping === 'self'

    // Boleh menulis tapi izin lihatnya tidak ada di model lama? Beri lihat juga —
    // di model lama, aksi tulis selalu dijalankan dari halaman yang sama.
    out.push({
      resource: def.key,
      viewScope: hasView || hasWrite ? 'OWN' : 'NONE',
      viewCompanyIds: [],
      writeScope: single || hasWrite ? 'OWN' : 'NONE',
      writeCompanyIds: [],
    })
  }
  return out
}

async function main() {
  const roles = await prisma.custom_role.findMany({
    select: {
      id: true,
      name: true,
      companyId: true,
      permissions: true,
      usesResourcePerms: true,
    },
    orderBy: { name: 'asc' },
  })

  console.log(`${roles.length} jabatan ditemukan. Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}\n`)

  for (const role of roles) {
    const label = `${role.name} (${role.companyId ?? 'GLOBAL'})`

    if (role.usesResourcePerms) {
      console.log(`  - ${label}: sudah pakai matriks izin, dilewati`)
      continue
    }

    const grants = grantsFor(role.permissions, role.name)
    const summary = grants.length
      ? grants.map((g) => `${g.resource}[${g.viewScope[0]}${g.writeScope !== 'NONE' ? '+W' : ''}]`).join(' ')
      : isGlobalRole(role.name)
        ? '(role global — ALL via kode)'
        : '(tidak ada izin)'
    console.log(`  ✓ ${label}: ${summary}`)

    if (!APPLY) continue

    await prisma.$transaction([
      prisma.roleResourcePermission.deleteMany({ where: { roleId: role.id } }),
      ...(grants.length
        ? [
            prisma.roleResourcePermission.createMany({
              data: grants.map((g) => ({ ...g, roleId: role.id })),
            }),
          ]
        : []),
      prisma.custom_role.update({
        where: { id: role.id },
        data: { usesResourcePerms: true },
      }),
    ])
  }

  console.log(
    APPLY
      ? '\nSelesai. Semua jabatan kini memakai matriks izin per-resource.'
      : '\nDry run selesai. Jalankan ulang dengan --apply untuk menulis ke database.'
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
