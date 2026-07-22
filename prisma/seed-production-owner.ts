/**
 * Script one-time: update production DB dengan owner@pvi.com (global owner)
 * dan hapus akun owner lama yang pakai email .local
 *
 * Pakai: npx tsx prisma/seed-production-owner.ts
 * (tanpa .env.local override — langsung pakai .env = production DB)
 */
import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import { hashPassword } from 'better-auth/crypto'
import { getPermissionsForRole } from '../src/lib/permissions'

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  connectionTimeoutMillis: 15_000,
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🔗 Connecting to:', process.env.DATABASE_URL?.replace(/:([^:@]+)@/, ':****@'))

  const hashedPassword = await hashPassword('password123')

  // Pastikan system role OWNER ada (companyId = null)
  const permissions = getPermissionsForRole('OWNER')
  let ownerRole = await prisma.custom_role.findFirst({ where: { name: 'OWNER', companyId: null } })
  if (ownerRole) {
    ownerRole = await prisma.custom_role.update({ where: { id: ownerRole.id }, data: { permissions } })
    console.log('✓ OWNER role updated:', ownerRole.id)
  } else {
    ownerRole = await prisma.custom_role.create({ data: { name: 'OWNER', companyId: null, permissions } })
    console.log('✓ OWNER role created:', ownerRole.id)
  }

  // Buat/update user owner@pvi.com (global, no company, no branch)
  const owner = await prisma.user.upsert({
    where: { email: 'owner@pvi.com' },
    update: {
      name: 'Owner',
      branchId: null,
      customRoleId: ownerRole.id,
      isActive: true,
      updatedAt: new Date(),
    },
    create: {
      id: 'usr_owner',
      name: 'Owner',
      email: 'owner@pvi.com',
      emailVerified: true,
      branchId: null,
      customRoleId: ownerRole.id,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  })
  console.log('✓ User owner@pvi.com upserted:', owner.id)

  // Pastikan akun credential ada
  await prisma.account.upsert({
    where: { id: `account_${owner.id}` },
    update: { password: hashedPassword, updatedAt: new Date() },
    create: {
      id: `account_${owner.id}`,
      accountId: owner.id,
      providerId: 'credential',
      userId: owner.id,
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  })
  console.log('✓ Credential account upserted')

  // Hapus akun owner lama yang pakai email .local
  const oldOwners = ['owner@pvi.local', 'owner@ptu.local', 'owner@pkd.local']
  for (const email of oldOwners) {
    const user = await prisma.user.findUnique({ where: { email } })
    if (user) {
      await prisma.account.deleteMany({ where: { userId: user.id } })
      await prisma.user.delete({ where: { email } })
      console.log(`🗑  Deleted old owner: ${email}`)
    } else {
      console.log(`   Not found (skip): ${email}`)
    }
  }

  console.log('\n✅ Done. Login dengan:')
  console.log('   Email   : owner@pvi.com')
  console.log('   Password: password123')
}

main().catch(console.error).finally(() => prisma.$disconnect())
