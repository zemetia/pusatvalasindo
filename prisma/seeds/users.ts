import { hashPassword } from 'better-auth/crypto'
import type { PrismaClient } from '../../src/generated/prisma/client'

const MOCK_USERS = [
  { id: 'user_superadmin', name: 'Super Admin', email: 'superadmin@zemetia.com', companyCode: null, branchName: null, systemRole: 'SUPER_ADMIN' },
  { id: 'user_owner_pvi', name: 'PVI Owner', email: 'owner@pusatvalasindo.com', companyCode: 'PVI', branchName: null, systemRole: 'OWNER' },
  { id: 'user_kasir_cengkareng', name: 'Kasir Cengkareng', email: 'kasir.cengkareng@zemetia.com', companyCode: 'PVI', branchName: 'Cengkareng', systemRole: null },
]

async function getOrCreateSystemRole(prisma: PrismaClient, name: string): Promise<string> {
  let role = await prisma.custom_role.findFirst({ where: { name, companyId: null } })
  if (!role) {
    role = await prisma.custom_role.create({ data: { name, companyId: null, permissions: [] } })
  }
  return role.id
}

export async function seedUsers(
  prisma: PrismaClient,
  companyIds: Record<string, string>,
  branchIds: Record<string, string>
): Promise<void> {
  const hashedPassword = await hashPassword('password123')

  const superAdminRoleId = await getOrCreateSystemRole(prisma, 'SUPER_ADMIN')
  const ownerRoleId = await getOrCreateSystemRole(prisma, 'OWNER')
  const systemRoleIds: Record<string, string> = {
    SUPER_ADMIN: superAdminRoleId,
    OWNER: ownerRoleId,
  }

  for (const u of MOCK_USERS) {
    const customRoleId = u.systemRole ? systemRoleIds[u.systemRole] : null

    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        name: u.name,
        companyId: u.companyCode ? companyIds[u.companyCode] : null,
        branchId: u.branchName ? branchIds[u.branchName] : null,
        customRoleId,
      },
      create: {
        id: u.id,
        name: u.name,
        email: u.email,
        emailVerified: true,
        companyId: u.companyCode ? companyIds[u.companyCode] : null,
        branchId: u.branchName ? branchIds[u.branchName] : null,
        customRoleId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    })

    await prisma.account.upsert({
      where: { id: `account_${user.id}` },
      update: { password: hashedPassword },
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
    console.log(`  ✓ User: ${u.name}`)
  }
}
