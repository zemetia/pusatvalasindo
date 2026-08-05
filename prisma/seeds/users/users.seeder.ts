/**
 * User seeder — satu akun per posisi, per perusahaan, per cabang.
 *
 * Daftar akunnya tinggal di file per PT (pvi.ts / ptu.ts / pkd.ts) dan
 * system.ts untuk akun global; file ini yang menautkannya ke role + cabang lalu
 * menulisnya. Isolasi data: posisi non-global terikat pada 1 perusahaan +
 * 1 cabang dan hanya bisa melihat data perusahaan sendiri (difilter di layer
 * service/query).
 *
 * Password semua akun: password123
 */
import { hashPassword } from 'better-auth/crypto'
import type { PrismaClient } from '../../../src/generated/prisma/client'
import { SYSTEM_USERS, ensureSystemRole } from './system'
import { PVI_USERS } from './pvi'
import { PTU_USERS } from './ptu'
import { PKD_USERS } from './pkd'
import type { UserDef } from './types'

const SEED_PASSWORD = 'password123'

const USERS: UserDef[] = [...SYSTEM_USERS, ...PVI_USERS, ...PTU_USERS, ...PKD_USERS]

/**
 * Ringkasan dihitung dari data, bukan ditulis tangan — angka yang diketik manual
 * langsung basi begitu satu akun ditambah di salah satu file PT.
 */
const GROUPS: { label: string; match: (u: UserDef) => boolean }[] = [
  { label: 'SUPER_ADMIN', match: (u) => u.roleName === 'SUPER_ADMIN' },
  { label: 'OWNER', match: (u) => u.roleName === 'OWNER' },
  { label: 'Kepala', match: (u) => u.roleName.startsWith('Kepala') },
  {
    label: 'Teller/Sales',
    match: (u) => ['Teller Dalam', 'Teller Luar', 'Marketing'].includes(u.roleName),
  },
  { label: 'Kurir', match: (u) => u.roleName === 'Kurir' },
]

function breakdown(users: UserDef[]): string {
  const perCompany = new Map<string, number>()
  for (const u of users) {
    const key = u.companyCode ?? 'global'
    perCompany.set(key, (perCompany.get(key) ?? 0) + 1)
  }
  return [...perCompany].map(([code, n]) => `${n}×${code}`).join(', ')
}

export async function seedUsers(
  prisma: PrismaClient,
  companyIds: Record<string, string>,
  branchIds: Record<string, string>
): Promise<void> {
  const hashedPassword = await hashPassword(SEED_PASSWORD)

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
    // A user's PT is derived from their branch — no companyId is stored on the user.
    const branchId     = u.branchName  ? branchIds[u.branchName]  ?? null : null

    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        name: u.name,
        branchId,
        customRoleId,
        baseSalary: u.baseSalary ?? null,
        employmentStatus: u.employmentStatus,
        contractEndDate: u.contractEndDate ? new Date(u.contractEndDate) : null,
        isActive: true,
        updatedAt: new Date(),
      },
      create: {
        id: u.id,
        name: u.name,
        email: u.email,
        emailVerified: true,
        branchId,
        customRoleId,
        baseSalary: u.baseSalary ?? null,
        employmentStatus: u.employmentStatus,
        contractEndDate: u.contractEndDate ? new Date(u.contractEndDate) : null,
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

  const grouped = GROUPS.map((g) => ({ label: g.label, users: USERS.filter(g.match) }))
  const ungrouped = USERS.filter((u) => !GROUPS.some((g) => g.match(u)))
  if (ungrouped.length > 0) {
    grouped.push({ label: 'Lainnya', users: ungrouped })
  }

  const width = Math.max(...grouped.map((g) => g.label.length))
  for (const g of grouped) {
    console.log(`     - ${g.label.padEnd(width)} : ${g.users.length}  (${breakdown(g.users)})`)
  }

  console.log(`\n  🔑 Password semua akun: ${SEED_PASSWORD}`)
  console.log(`\n  Akun login tersedia:`)
  for (const g of grouped) {
    if (g.users.length === 0) continue
    console.log(`\n  [${g.label}]`)
    g.users.forEach((u) => console.log(`    ${u.email}`))
  }
}
