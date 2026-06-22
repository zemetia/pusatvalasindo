/**
 * User seeder — satu akun per posisi, per perusahaan, per cabang.
 *
 * Isolasi data:
 *  - SUPER_ADMIN  : tidak terikat perusahaan, bisa lihat seluruh data lintas perusahaan
 *  - OWNER        : global (lintas perusahaan), permission = ALL
 *  - Posisi lain  : terikat pada 1 perusahaan + 1 cabang, hanya bisa lihat data
 *                   perusahaan sendiri (difilter di layer service/query)
 *
 * Password semua akun: password123
 */
import { hashPassword } from 'better-auth/crypto'
import type { PrismaClient } from '../../src/generated/prisma/client'
import { getPermissionsForRole } from '../../src/lib/permissions'

// ─────────────────────────────────────────────────────────────────────────────
// Tipe bantu
// ─────────────────────────────────────────────────────────────────────────────

type UserDef = {
  id: string
  name: string
  email: string
  roleName: string
  /** null = role sistem global (SUPER_ADMIN / OWNER tanpa perusahaan spesifik) */
  companyCode: string | null
  /** null = tidak terikat cabang (owner, atau posisi lintas cabang) */
  branchName: string | null
  baseSalary?: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Definisi pengguna
// ─────────────────────────────────────────────────────────────────────────────

const USERS: UserDef[] = [
  // ── SISTEM GLOBAL ──────────────────────────────────────────────────────────
  {
    id: 'usr_superadmin',
    name: 'Super Admin',
    email: 'superadmin@system.local',
    roleName: 'SUPER_ADMIN',
    companyCode: null,
    branchName: null,
  },
  // Owner global — 1 akun, akses penuh ke seluruh perusahaan
  {
    id: 'usr_owner',
    name: 'Owner',
    email: 'owner@pvi.com',
    roleName: 'OWNER',
    companyCode: null,
    branchName: null,
  },

  // ── PVI — Pusat Valas Indo ─────────────────────────────────────────────────
  // Kepala Cabang Cengkareng — bisa kelola staf dan operasional cabang
  {
    id: 'usr_kepala_pvi_cengkareng',
    name: 'Kepala Cabang Cengkareng',
    email: 'kepala.cengkareng@pvi.local',
    roleName: 'Kepala Cabang',
    companyCode: 'PVI',
    branchName: 'Cengkareng',
    baseSalary: 6_000_000,
  },
  // Teller Dalam — Cengkareng
  {
    id: 'usr_teller_dalam_pvi_cengkareng',
    name: 'Teller Dalam Cengkareng',
    email: 'teller.dalam.cengkareng@pvi.local',
    roleName: 'Teller Dalam',
    companyCode: 'PVI',
    branchName: 'Cengkareng',
    baseSalary: 3_500_000,
  },
  // Teller Luar — Cengkareng
  {
    id: 'usr_teller_luar_pvi_cengkareng',
    name: 'Teller Luar Cengkareng',
    email: 'teller.luar.cengkareng@pvi.local',
    roleName: 'Teller Luar',
    companyCode: 'PVI',
    branchName: 'Cengkareng',
    baseSalary: 3_500_000,
  },
  // Kurir — Cengkareng
  {
    id: 'usr_kurir_pvi_cengkareng',
    name: 'Kurir Cengkareng',
    email: 'kurir.cengkareng@pvi.local',
    roleName: 'Kurir',
    companyCode: 'PVI',
    branchName: 'Cengkareng',
    baseSalary: 2_800_000,
  },
  // Kepala Cabang Tangerang
  {
    id: 'usr_kepala_pvi_tangerang',
    name: 'Kepala Cabang Tangerang',
    email: 'kepala.tangerang@pvi.local',
    roleName: 'Kepala Cabang',
    companyCode: 'PVI',
    branchName: 'Tangerang',
    baseSalary: 6_000_000,
  },
  // Teller Dalam — Tangerang
  {
    id: 'usr_teller_dalam_pvi_tangerang',
    name: 'Teller Dalam Tangerang',
    email: 'teller.dalam.tangerang@pvi.local',
    roleName: 'Teller Dalam',
    companyCode: 'PVI',
    branchName: 'Tangerang',
    baseSalary: 3_500_000,
  },
  // Sales & Compliance — Tangerang
  {
    id: 'usr_sales_pvi_tangerang',
    name: 'Sales Compliance Tangerang',
    email: 'sales.tangerang@pvi.local',
    roleName: 'Sales & Compliance',
    companyCode: 'PVI',
    branchName: 'Tangerang',
    baseSalary: 3_800_000,
  },

  // ── PTU — Pusat Tukar Uang ─────────────────────────────────────────────────
  // Kepala Marketing — Pluit
  {
    id: 'usr_kepala_ptu_pluit',
    name: 'Kepala Marketing Pluit',
    email: 'kepala.pluit@ptu.local',
    roleName: 'Kepala Marketing',
    companyCode: 'PTU',
    branchName: 'Pluit',
    baseSalary: 6_000_000,
  },
  // Teller Dalam — Pluit
  {
    id: 'usr_teller_dalam_ptu_pluit',
    name: 'Teller Dalam Pluit',
    email: 'teller.dalam.pluit@ptu.local',
    roleName: 'Teller Dalam',
    companyCode: 'PTU',
    branchName: 'Pluit',
    baseSalary: 3_500_000,
  },
  // Teller Luar — Pluit
  {
    id: 'usr_teller_luar_ptu_pluit',
    name: 'Teller Luar Pluit',
    email: 'teller.luar.pluit@ptu.local',
    roleName: 'Teller Luar',
    companyCode: 'PTU',
    branchName: 'Pluit',
    baseSalary: 3_500_000,
  },
  // Sales & Compliance — Pluit
  {
    id: 'usr_sales_ptu_pluit',
    name: 'Sales Compliance Pluit',
    email: 'sales.pluit@ptu.local',
    roleName: 'Sales & Compliance',
    companyCode: 'PTU',
    branchName: 'Pluit',
    baseSalary: 3_800_000,
  },

  // ── PKD — Pusat Kirim Duit ─────────────────────────────────────────────────
  // Kepala Cabang — PKD
  {
    id: 'usr_kepala_pkd',
    name: 'Kepala Cabang PKD',
    email: 'kepala@pkd.local',
    roleName: 'Kepala Cabang',
    companyCode: 'PKD',
    branchName: 'Pusat Kirim Duit',
    baseSalary: 6_000_000,
  },
  // Teller Dalam — PKD
  {
    id: 'usr_teller_dalam_pkd',
    name: 'Teller Dalam PKD',
    email: 'teller.dalam@pkd.local',
    roleName: 'Teller Dalam',
    companyCode: 'PKD',
    branchName: 'Pusat Kirim Duit',
    baseSalary: 3_500_000,
  },
  // Teller Luar — PKD
  {
    id: 'usr_teller_luar_pkd',
    name: 'Teller Luar PKD',
    email: 'teller.luar@pkd.local',
    roleName: 'Teller Luar',
    companyCode: 'PKD',
    branchName: 'Pusat Kirim Duit',
    baseSalary: 3_500_000,
  },
  // Kurir — PKD
  {
    id: 'usr_kurir_pkd',
    name: 'Kurir PKD',
    email: 'kurir@pkd.local',
    roleName: 'Kurir',
    companyCode: 'PKD',
    branchName: 'Pusat Kirim Duit',
    baseSalary: 2_800_000,
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Helper: pastikan role sistem (SUPER_ADMIN / OWNER) tersedia
// ─────────────────────────────────────────────────────────────────────────────

async function ensureSystemRole(prisma: PrismaClient, name: string): Promise<string> {
  const permissions = getPermissionsForRole(name)
  const existing = await prisma.custom_role.findFirst({ where: { name, companyId: null } })
  if (existing) {
    await prisma.custom_role.update({ where: { id: existing.id }, data: { permissions } })
    return existing.id
  }
  const created = await prisma.custom_role.create({ data: { name, companyId: null, permissions } })
  return created.id
}

// ─────────────────────────────────────────────────────────────────────────────
// Export utama
// ─────────────────────────────────────────────────────────────────────────────

export async function seedUsers(
  prisma: PrismaClient,
  companyIds: Record<string, string>,
  branchIds: Record<string, string>
): Promise<void> {
  const hashedPassword = await hashPassword('password123')

  // ── 1. Siapkan role sistem ────────────────────────────────────────────────
  const superAdminRoleId = await ensureSystemRole(prisma, 'SUPER_ADMIN')
  const ownerRoleId      = await ensureSystemRole(prisma, 'OWNER')

  // ── 2. Cache semua company-scoped roles sekali query ─────────────────────
  //    key: "{name}::{companyId}"
  const allRoles = await prisma.custom_role.findMany({
    where: { companyId: { not: null } },
    select: { id: true, name: true, companyId: true },
  })
  const roleCache: Record<string, string> = {}
  for (const r of allRoles) {
    roleCache[`${r.name}::${r.companyId}`] = r.id
  }

  // ── 3. Helper: cari customRoleId untuk sebuah user ────────────────────────
  function resolveRoleId(roleName: string, companyCode: string | null): string | null {
    if (roleName === 'SUPER_ADMIN') return superAdminRoleId
    if (roleName === 'OWNER')       return ownerRoleId

    if (!companyCode) {
      console.warn(`  ⚠  Tidak ada companyCode untuk role "${roleName}" — lewati`)
      return null
    }
    const companyId = companyIds[companyCode]
    if (!companyId) {
      console.warn(`  ⚠  Company "${companyCode}" tidak ditemukan — lewati`)
      return null
    }
    const key = `${roleName}::${companyId}`
    const id  = roleCache[key]
    if (!id) {
      console.warn(`  ⚠  Role "${roleName}" untuk company "${companyCode}" tidak ada di DB — lewati`)
      return null
    }
    return id
  }

  // ── 4. Upsert setiap user ────────────────────────────────────────────────
  console.log('\n  👥 Membuat pengguna...')

  for (const u of USERS) {
    const customRoleId = resolveRoleId(u.roleName, u.companyCode)
    const companyId    = u.companyCode ? companyIds[u.companyCode] ?? null : null
    const branchId     = u.branchName  ? branchIds[u.branchName]  ?? null : null

    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        name: u.name,
        companyId,
        branchId,
        customRoleId,
        baseSalary: u.baseSalary ?? null,
        isActive: true,
        updatedAt: new Date(),
      },
      create: {
        id: u.id,
        name: u.name,
        email: u.email,
        emailVerified: true,
        companyId,
        branchId,
        customRoleId,
        baseSalary: u.baseSalary ?? null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    })

    // Pastikan akun credential tersedia
    await prisma.account.upsert({
      where: { id: `account_${user.id}` },
      update: { password: hashedPassword, updatedAt: new Date() },
      create: {
        id: `account_${user.id}`,
        accountId: user.id,
        providerId: 'credential',
        userId: user.id,
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    })

    const scope = u.companyCode
      ? `${u.companyCode}${u.branchName ? ` / ${u.branchName}` : ' (owner)'}`
      : 'GLOBAL'

    console.log(`  ✓  [${scope}] ${u.name} <${u.email}> — ${u.roleName}`)
  }

  // ── 5. Ringkasan ─────────────────────────────────────────────────────────
  console.log(`\n  📊 Total pengguna di-seed: ${USERS.length}`)
  console.log(`     - SUPER_ADMIN : 1  (global)`)
  console.log(`     - Owner       : 1  (global — owner@pvi.com)`)
  console.log(`     - Kepala      : 4  (2×PVI, 1×PTU, 1×PKD)`)
  console.log(`     - Teller/Sales: 8  (3×PVI, 3×PTU, 2×PKD)`)
  console.log(`     - Kurir       : 2  (1×PVI, 1×PKD)`)
  console.log(`\n  🔑 Password semua akun: password123`)
  console.log(`\n  Akun login tersedia:`)

  const groups = [
    { label: 'SUPER_ADMIN', users: USERS.filter(u => u.roleName === 'SUPER_ADMIN') },
    { label: 'OWNER',       users: USERS.filter(u => u.roleName === 'OWNER') },
    { label: 'Kepala',      users: USERS.filter(u => u.roleName.startsWith('Kepala')) },
    { label: 'Teller/Sales',users: USERS.filter(u => ['Teller Dalam','Teller Luar','Sales & Compliance'].includes(u.roleName)) },
    { label: 'Kurir',       users: USERS.filter(u => u.roleName === 'Kurir') },
  ]
  for (const g of groups) {
    console.log(`\n  [${g.label}]`)
    g.users.forEach(u => console.log(`    ${u.email}`))
  }
}
