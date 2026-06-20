import type { PrismaClient } from '../../src/generated/prisma/client'

const COMPANIES = [
  { id: '1', name: 'Pusat Valas Indo', code: 'PVI' },
  { id: '2', name: 'Pusat Tukar Uang', code: 'PTU' },
  { id: '3', name: 'Pusat Kirim Duit', code: 'PKD' },
]

export async function seedCompanies(prisma: PrismaClient): Promise<Record<string, string>> {
  const ids: Record<string, string> = {}
  for (const c of COMPANIES) {
    const company = await prisma.company.upsert({
      where: { code: c.code },
      update: { name: c.name, id: c.id },
      create: { id: c.id, name: c.name, code: c.code },
    })
    ids[c.code] = company.id
    console.log(`  ✓ Company: ${company.name} (${company.id})`)
  }
  return ids
}
