import type { PrismaClient } from '../../src/generated/prisma/client'

type KasPocketDef = { name: string; code: string | null; sortOrder: number }

// Snapshot dari data production saat ini (2026-07-12) — hanya PVI yang sudah
// punya pocket kas. PTU & PKD belum punya, jadi tidak diseed di sini.
const PVI_KAS_POCKETS: KasPocketDef[] = [
  { name: 'BRANGKAS', code: 'BR1', sortOrder: 0 },
  { name: 'UANG KECIL BRANGKAS', code: 'UKB', sortOrder: 1 },
  { name: 'GEPOKAN', code: 'GPK', sortOrder: 2 },
  { name: 'UANG LACI', code: 'UL1', sortOrder: 3 },
]

const COMPANY_KAS_POCKETS: Record<string, KasPocketDef[]> = {
  PVI: PVI_KAS_POCKETS,
}

export async function seedKasPockets(
  prisma: PrismaClient,
  companyIds: Record<string, string>
): Promise<void> {
  for (const [companyCode, companyId] of Object.entries(companyIds)) {
    const pockets = COMPANY_KAS_POCKETS[companyCode]
    if (!pockets) continue
    for (const pocket of pockets) {
      await prisma.kasPocket.upsert({
        where: { companyId_name: { companyId, name: pocket.name } },
        update: {},
        create: {
          companyId,
          name: pocket.name,
          code: pocket.code,
          sortOrder: pocket.sortOrder,
          isActive: true,
        },
      })
    }
    console.log(`  ✓ ${pockets.length} kas pockets seeded for ${companyCode}`)
  }
}
