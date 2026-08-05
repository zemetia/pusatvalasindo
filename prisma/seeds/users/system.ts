// Akun & role sistem yang tidak terikat perusahaan mana pun.
//
//  - SUPER_ADMIN : tidak terikat perusahaan, bisa lihat seluruh data lintas perusahaan
//  - OWNER       : global (lintas perusahaan), permission = ALL

import type { PrismaClient } from '../../../src/generated/prisma/client'
import { getPermissionsForRole } from '../../../src/lib/permissions'
import type { UserDef } from './types'

export const SYSTEM_USERS: UserDef[] = [
  {
    id: 'usr_superadmin',
    name: 'Super Admin',
    email: 'superadmin@system.local',
    roleName: 'SUPER_ADMIN',
    companyCode: null,
    branchName: null,
    // Akun sistem, bukan karyawan yang digaji — statusnya tidak relevan, tapi
    // tetap ditulis eksplisit supaya tidak ada baris yang lolos tanpa keputusan.
    employmentStatus: 'BELUM_KONTRAK',
  },
  // Owner global — 1 akun, akses penuh ke seluruh perusahaan
  {
    id: 'usr_owner',
    name: 'Owner',
    email: 'owner@pvi.com',
    roleName: 'OWNER',
    companyCode: null,
    branchName: null,
    // Akun sistem, bukan karyawan yang digaji — statusnya tidak relevan, tapi
    // tetap ditulis eksplisit supaya tidak ada baris yang lolos tanpa keputusan.
    employmentStatus: 'BELUM_KONTRAK',
  },
]

/** Role sistem tidak ikut seeder role per PT, jadi disiapkan di sini. */
export async function ensureSystemRole(prisma: PrismaClient, name: string): Promise<string> {
  const permissions = getPermissionsForRole(name)
  const existing = await prisma.custom_role.findFirst({ where: { name, companyId: null } })
  if (existing) {
    await prisma.custom_role.update({ where: { id: existing.id }, data: { permissions } })
    return existing.id
  }
  const created = await prisma.custom_role.create({ data: { name, companyId: null, permissions } })
  return created.id
}
