// Penyesuaian wewenang (permintaan Agustus 2026). Dua lapis aturan:
//
// A. Per nama jabatan, berlaku di seluruh PT:
//   Teller Luar       → HANYA Presensi & KPI. Seluruh sisi stok, kas, mata uang,
//                       kurs, dan Watcher Valas dicabut.
//   Kepala Marketing  → dapat "Patokan Harga" (lihat + ubah); kehilangan
//                       "Presensi Karyawan".
//   Kepala Cabang     → boleh MENGUBAH "Stock & Kas Harian" dan "Saldo Bank
//                       Harian" (sebelumnya lihat saja). Rekening Bank tidak
//                       ikut — itu data induk, bukan angka harian.
//
// B. Per PT, berlaku untuk SETIAP jabatan di PT itu:
//   PKD → tidak ada modul valas sama sekali (kurs, stok, kas, transaksi valas).
//
// Aturan PT MENANG atas aturan jabatan: Kepala Cabang PKD tidak mendapat hak
// ubah Stock & Kas, dan Kepala Marketing PKD tidak mendapat Patokan Harga —
// halaman yang tidak dipakai PKD tidak perlu dibukakan pintunya dulu.
//
// Dua lapis penyimpanan dibereskan sekaligus supaya aksesnya tidak hidup/mati
// lagi lewat pintu belakang: baris RoleResourcePermission (gerbang yang
// benar-benar dipakai karena seluruh jabatan sudah `usesResourcePerms`) DAN
// array `permissions` lama (dipakai fallback legacy, dan ditulis ulang oleh
// seeder/sync — lihat juga PKD_REVOKED_PERMISSIONS di src/lib/permissions.ts).
//
// `price.benchmark` sengaja tanpa peta legacy di registry, jadi untuk resource
// itu hanya baris matriks yang ditulis — tidak ada permission lama yang setara.
//
// Aman diulang (idempotent).
//   npx tsx prisma/scripts/apply-role-access-2026-08.ts --server
//   npx tsx prisma/scripts/apply-role-access-2026-08.ts --server --apply

import { config } from 'dotenv'
config({ path: '.env.local' })
config()
import { PrismaClient } from '../../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import { writeFileSync } from 'node:fs'
import path from 'node:path'

const BACKUP_PATH = path.join(process.cwd(), 'backup-role-access-2026-08.json')

const APPLY = process.argv.includes('--apply')
// --server = DB server (PRISMA_DATABASE_URL); tanpa flag = DATABASE_URL lokal.
const CONN = process.argv.includes('--server')
  ? process.env.PRISMA_DATABASE_URL
  : process.env.DATABASE_URL

const pool = new pg.Pool({ connectionString: CONN, max: 3 })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

type ScopeMode = 'NONE' | 'OWN' | 'SELECTED' | 'ALL'

type Plan = {
  /** Baris matriks yang dihapus seluruhnya. */
  revokeResources?: string[]
  /**
   * Baris matriks yang dibuat/disetel. Sumbu yang tidak disebut dibiarkan apa
   * adanya pada baris yang sudah ada, dan NONE untuk baris baru — supaya
   * memberi hak tulis tidak diam-diam melebarkan hak baca yang sudah dipersempit.
   */
  setResources?: { resource: string; view?: ScopeMode; write?: ScopeMode }[]
  /** Permission lama yang dicabut dari `custom_role.permissions`. */
  revokeLegacy?: string[]
  /** Permission lama yang ditambahkan ke `custom_role.permissions`. */
  grantLegacy?: string[]
}

// ── A. Rencana per nama jabatan (dinormalkan huruf kecil) ────────────────────
const ROLE_PLANS: Record<string, Plan> = {
  // Sisakan `attendance.self` + `kpi.self`. `watcher.valas` ikut dicabut karena
  // legacy view-nya menumpang STOCKIST_VIEW — kurs pasar bukan urusan teller luar.
  'teller luar': {
    revokeResources: [
      'stockist.daily',
      'currency',
      'currency.price',
      'currency.stock',
      'watcher.valas',
    ],
    revokeLegacy: [
      'stockist.view',
      'stockist.manage',
      'stock.view',
      'stock.manage',
      'currency.view',
    ],
  },

  'kepala marketing': {
    // Resource global: satu-satunya mode bermakna adalah "semua PT".
    setResources: [{ resource: 'price.benchmark', view: 'ALL', write: 'ALL' }],
    revokeResources: ['attendance.all'],
    revokeLegacy: ['attendance.view_all', 'attendance.manage'],
  },

  'kepala cabang': {
    setResources: [
      { resource: 'stockist.daily', write: 'OWN' },
      { resource: 'bank.daily', write: 'OWN' },
    ],
    grantLegacy: ['stockist.manage', 'bank.daily_input'],
  },
}

// ── B. Rencana per PT, kena ke SETIAP jabatan PT itu ─────────────────────────
// PKD adalah jasa kirim uang: tidak ada laci valas, tidak ada kas cabang yang
// dihitung ulang tiap sore, dan tidak ada kurs beli/jual yang dipasang. Bank
// sengaja TIDAK ikut dicabut — mengirim uang justru butuh rekening.
const COMPANY_PLANS: Record<string, Plan> = {
  PKD: {
    revokeResources: [
      // Kurs & mata uang
      'currency',
      'currency.price',
      'currency.stock',
      'price.benchmark',
      'watcher.valas',
      // Stock & kas
      'stockist.daily',
      'stockist.verify',
      'stock.pt',
      // Transaksi valas di loket
      'valas.transaction',
      'valas.transaction.void',
    ],
    revokeLegacy: [
      'currency.view',
      'currency.manage',
      'stock.view',
      'stock.manage',
      'stockist.view',
      'stockist.manage',
      'stockist.verify',
      'company_stock.view',
      'company_stock.manage',
      'valas_transaction.view',
      'valas_transaction.create',
      'valas_transaction.void',
    ],
  },
}

/**
 * Gabungan rencana jabatan + rencana PT-nya. Pencabutan MENANG: resource yang
 * dicabut PT-nya dibuang dari daftar `setResources`, dan permission lama yang
 * dicabut tidak boleh ditambahkan kembali oleh `grantLegacy`.
 */
function mergePlans(rolePlan: Plan | undefined, companyPlan: Plan | undefined): Plan {
  const revokeResources = [
    ...new Set([...(rolePlan?.revokeResources ?? []), ...(companyPlan?.revokeResources ?? [])]),
  ]
  const revokeLegacy = [
    ...new Set([...(rolePlan?.revokeLegacy ?? []), ...(companyPlan?.revokeLegacy ?? [])]),
  ]
  return {
    revokeResources,
    revokeLegacy,
    setResources: [...(rolePlan?.setResources ?? []), ...(companyPlan?.setResources ?? [])].filter(
      (s) => !revokeResources.includes(s.resource)
    ),
    grantLegacy: [...(rolePlan?.grantLegacy ?? []), ...(companyPlan?.grantLegacy ?? [])].filter(
      (p) => !revokeLegacy.includes(p)
    ),
  }
}

async function main() {
  console.log('DB   :', (CONN ?? '').replace(/:\/\/[^@]*@/, '://***@'))
  console.log('Mode :', APPLY ? 'APPLY (menulis)' : 'DRY RUN')

  const companies = await prisma.company.findMany({ select: { id: true, name: true, code: true } })
  const companyById = new Map(companies.map((c) => [c.id, c]))

  // Setiap jabatan yang kena salah satu dari dua lapis aturan.
  const companyIdsWithPlan = companies
    .filter((c) => COMPANY_PLANS[c.code.toUpperCase()])
    .map((c) => c.id)

  const roles = await prisma.custom_role.findMany({
    where: {
      OR: [
        { name: { in: Object.keys(ROLE_PLANS), mode: 'insensitive' } },
        { companyId: { in: companyIdsWithPlan } },
      ],
    },
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

  if (roles.length === 0) {
    console.log('\nTidak ada jabatan yang cocok di database ini.')
    return
  }

  const backup: unknown[] = []

  for (const role of roles) {
    const company = role.companyId ? companyById.get(role.companyId) : undefined
    const plan = mergePlans(
      ROLE_PLANS[role.name.trim().toLowerCase()],
      company ? COMPANY_PLANS[company.code.toUpperCase()] : undefined
    )

    const label = `${role.name} @ ${company?.code ?? 'GLOBAL'}`
    const byResource = new Map(role.resourcePerms.map((g) => [g.resource, g]))

    // ── Apa yang berubah ────────────────────────────────────────────────────
    const toRevoke = (plan.revokeResources ?? []).filter((r) => byResource.has(r))

    const toSet = (plan.setResources ?? [])
      .map((s) => {
        const cur = byResource.get(s.resource)
        const view = s.view ?? (cur?.viewScope as ScopeMode | undefined) ?? 'NONE'
        const write = s.write ?? (cur?.writeScope as ScopeMode | undefined) ?? 'NONE'
        const changed = !cur || cur.viewScope !== view || cur.writeScope !== write
        return { ...s, view, write, changed }
      })
      .filter((s) => s.changed)

    const legacyOut = role.permissions.filter((p) => (plan.revokeLegacy ?? []).includes(p))
    const legacyIn = (plan.grantLegacy ?? []).filter((p) => !role.permissions.includes(p))

    const noop =
      toRevoke.length === 0 && toSet.length === 0 && legacyOut.length === 0 && legacyIn.length === 0

    console.log(`\n${label} (${role._count.users} user, matriks=${role.usesResourcePerms})`)
    if (noop) {
      console.log('  (sudah sesuai)')
    } else {
      console.log(`  resource dicabut : ${toRevoke.join(', ') || '—'}`)
      console.log(
        `  resource disetel : ${
          toSet.map((s) => `${s.resource}(view=${s.view},write=${s.write})`).join(', ') || '—'
        }`
      )
      console.log(`  legacy dicabut   : ${legacyOut.join(', ') || '—'}`)
      console.log(`  legacy ditambah  : ${legacyIn.join(', ') || '—'}`)
    }

    if (!APPLY || noop) continue

    // Keadaan sebelum diubah, supaya bisa dikembalikan tanpa menebak.
    backup.push({
      roleId: role.id,
      name: role.name,
      companyId: role.companyId,
      permissions: role.permissions,
      resourcePerms: role.resourcePerms,
    })

    const nextPermissions = [
      ...role.permissions.filter((p) => !(plan.revokeLegacy ?? []).includes(p)),
      ...legacyIn,
    ]

    await prisma.$transaction([
      prisma.roleResourcePermission.deleteMany({
        where: { roleId: role.id, resource: { in: toRevoke } },
      }),
      ...toSet.map((s) =>
        prisma.roleResourcePermission.upsert({
          where: { roleId_resource: { roleId: role.id, resource: s.resource } },
          create: {
            roleId: role.id,
            resource: s.resource,
            viewScope: s.view,
            viewCompanyIds: [],
            writeScope: s.write,
            writeCompanyIds: [],
          },
          // Daftar PT hanya ikut dikosongkan saat sumbunya memang tidak lagi
          // SELECTED — kalau tidak, mode SELECTED yang tersisa kehilangan isinya.
          update: {
            viewScope: s.view,
            writeScope: s.write,
            ...(s.view === 'SELECTED' ? {} : { viewCompanyIds: [] }),
            ...(s.write === 'SELECTED' ? {} : { writeCompanyIds: [] }),
          },
        })
      ),
      prisma.custom_role.update({
        where: { id: role.id },
        data: { permissions: nextPermissions },
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
