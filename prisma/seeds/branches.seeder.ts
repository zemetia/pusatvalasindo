import type { PrismaClient } from '../../src/generated/prisma/client'

const BRANCH_CONFIGS = [
  { name: 'Cengkareng', address: 'Cengkareng, Jakarta Barat', phone: null, companyCode: 'PVI' },
  { name: 'Tangerang', address: 'Tangerang, Banten', phone: null, companyCode: 'PVI' },
  {
    name: 'Pusat Kirim Duit',
    address: 'Rukan Wall Street Blok A No 16, Green Lake City, Cipondoh, Kota Tangerang',
    phone: '08777169 0203',
    companyCode: 'PKD',
  },
  { name: 'Pluit', address: 'Pluit, Jakarta Utara', phone: null, companyCode: 'PTU' },
]

export async function seedBranches(
  prisma: PrismaClient,
  companyIds: Record<string, string>
): Promise<Record<string, string>> {
  const ids: Record<string, string> = {}
  for (const config of BRANCH_CONFIGS) {
    let branch = await prisma.branch.findFirst({ where: { name: config.name } })
    if (!branch) {
      branch = await prisma.branch.create({
        data: {
          name: config.name,
          address: config.address,
          phone: config.phone,
          companyId: companyIds[config.companyCode],
        },
      })
    } else {
      await prisma.branch.update({
        where: { id: branch.id },
        data: { companyId: companyIds[config.companyCode] },
      })
    }
    ids[config.name] = branch.id
    console.log(`  ✓ Branch: ${branch.name} (${branch.id})`)
  }
  return ids
}
