import type { PrismaClient } from '../../src/generated/prisma/client'

type PocketDef = { name: string; code: string | null; sortOrder: number }

// Snapshot dari data production saat ini (2026-07-12) — hanya PVI yang sudah
// punya pocket stockist. PTU & PKD belum punya, jadi tidak diseed di sini.
// Pocket "Total" (isDefault) tidak diseed manual — dibuat otomatis on-demand
// oleh stockist-pocket.repository.ts (ensureTotalPocket).
const PVI_POCKETS: PocketDef[] = [
  { name: 'BRANGKAS', code: 'BR1', sortOrder: 0 },
  { name: 'KANTONG', code: 'KTG', sortOrder: 1 },
  { name: 'UANG KECIL', code: 'UK1', sortOrder: 2 },
  { name: 'KURIR HUSNI', code: 'K_HS', sortOrder: 3 },
  { name: 'KURIR AGUS', code: 'K_AG', sortOrder: 4 },
  { name: 'KURIR AMIR', code: 'K_AM', sortOrder: 5 },
  { name: 'OTHER', code: 'OTH', sortOrder: 6 },
]

const COMPANY_POCKETS: Record<string, PocketDef[]> = {
  PVI: PVI_POCKETS,
}

export async function seedStockistPockets(
  prisma: PrismaClient,
  companyIds: Record<string, string>
): Promise<void> {
  for (const [companyCode, companyId] of Object.entries(companyIds)) {
    const pockets = COMPANY_POCKETS[companyCode]
    if (!pockets) continue
    for (const pocket of pockets) {
      await prisma.stockistPocket.upsert({
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
    console.log(`  ✓ ${pockets.length} stockist pockets seeded for ${companyCode}`)
  }
}
