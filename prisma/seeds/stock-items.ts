import type { PrismaClient, StockItemType } from '../../src/generated/prisma/client'

type StockItemDef = { name: string; code: string | null; type: StockItemType; sortOrder: number }

const PVI_PTU_ITEMS: StockItemDef[] = [
  { name: 'LM SILVER', code: null, type: 'GOLD', sortOrder: 0 },
  { name: 'LM', code: null, type: 'GOLD', sortOrder: 1 },
  { name: 'AED', code: 'AED', type: 'CURRENCY', sortOrder: 10 },
  { name: 'AUD', code: 'AUD', type: 'CURRENCY', sortOrder: 11 },
  { name: 'BAHRAIN', code: 'BHD', type: 'CURRENCY', sortOrder: 12 },
  { name: 'CAD', code: 'CAD', type: 'CURRENCY', sortOrder: 13 },
  { name: 'DENIS', code: 'DKK', type: 'CURRENCY', sortOrder: 14 },
  { name: 'EUR', code: 'EUR', type: 'CURRENCY', sortOrder: 15 },
  { name: 'HKD', code: 'HKD', type: 'CURRENCY', sortOrder: 16 },
  { name: 'INR', code: 'INR', type: 'CURRENCY', sortOrder: 17 },
  { name: 'IQD', code: 'IQD', type: 'CURRENCY', sortOrder: 18 },
  { name: 'JPY', code: 'JPY', type: 'CURRENCY', sortOrder: 19 },
  { name: 'JORDAN', code: 'JOD', type: 'CURRENCY', sortOrder: 20 },
  { name: 'KRW', code: 'KRW', type: 'CURRENCY', sortOrder: 21 },
  { name: 'KWD', code: 'KWD', type: 'CURRENCY', sortOrder: 22 },
  { name: 'MYR', code: 'MYR', type: 'CURRENCY', sortOrder: 23 },
  { name: 'NZD', code: 'NZD', type: 'CURRENCY', sortOrder: 24 },
  { name: 'NORWEGIAN', code: 'NOK', type: 'CURRENCY', sortOrder: 25 },
  { name: 'OMR', code: 'OMR', type: 'CURRENCY', sortOrder: 26 },
  { name: 'PHP', code: 'PHP', type: 'CURRENCY', sortOrder: 27 },
  { name: 'GBP', code: 'GBP', type: 'CURRENCY', sortOrder: 28 },
  { name: 'QAR', code: 'QAR', type: 'CURRENCY', sortOrder: 29 },
  { name: 'RUB', code: 'RUB', type: 'CURRENCY', sortOrder: 30 },
  { name: 'SAR', code: 'SAR', type: 'CURRENCY', sortOrder: 31 },
  { name: 'SGD BESAR', code: 'SGD', type: 'CURRENCY', sortOrder: 32 },
  { name: 'SGD KECIL', code: 'SGD', type: 'CURRENCY', sortOrder: 33 },
  { name: 'SWEDIA KRONER', code: 'SEK', type: 'CURRENCY', sortOrder: 34 },
  { name: 'CHF', code: 'CHF', type: 'CURRENCY', sortOrder: 35 },
  { name: 'TWD', code: 'TWD', type: 'CURRENCY', sortOrder: 36 },
  { name: 'THB', code: 'THB', type: 'CURRENCY', sortOrder: 37 },
  { name: 'TRY', code: 'TRY', type: 'CURRENCY', sortOrder: 38 },
  { name: 'USD', code: 'USD', type: 'CURRENCY', sortOrder: 39 },
  { name: 'VND', code: 'VND', type: 'CURRENCY', sortOrder: 40 },
  { name: 'CNY', code: 'CNY', type: 'CURRENCY', sortOrder: 41 },
  { name: 'TUNAI', code: null, type: 'CASH', sortOrder: 50 },
  { name: 'KAS TUNAI', code: null, type: 'CASH', sortOrder: 51 },
]

const PKD_ITEMS: StockItemDef[] = [
  { name: 'SGD', code: 'SGD', type: 'CURRENCY', sortOrder: 10 },
  { name: 'AUD', code: 'AUD', type: 'CURRENCY', sortOrder: 11 },
  { name: 'HKD', code: 'HKD', type: 'CURRENCY', sortOrder: 12 },
  { name: 'USD', code: 'USD', type: 'CURRENCY', sortOrder: 13 },
  { name: 'JPY', code: 'JPY', type: 'CURRENCY', sortOrder: 14 },
  { name: 'GBP', code: 'GBP', type: 'CURRENCY', sortOrder: 15 },
  { name: 'EUR', code: 'EUR', type: 'CURRENCY', sortOrder: 16 },
  { name: 'CHF', code: 'CHF', type: 'CURRENCY', sortOrder: 17 },
  { name: 'NZD', code: 'NZD', type: 'CURRENCY', sortOrder: 18 },
  { name: 'CAD', code: 'CAD', type: 'CURRENCY', sortOrder: 19 },
  { name: 'KAS TUNAI', code: null, type: 'CASH', sortOrder: 50 },
]

const BRANCH_ITEMS: Record<string, StockItemDef[]> = {
  Cengkareng: PVI_PTU_ITEMS,
  Tangerang: PVI_PTU_ITEMS,
  'Pusat Kirim Duit': PKD_ITEMS,
  Pluit: PVI_PTU_ITEMS,
}

export async function seedStockItems(
  prisma: PrismaClient,
  branchIds: Record<string, string>
): Promise<void> {
  for (const [branchName, branchId] of Object.entries(branchIds)) {
    const items = BRANCH_ITEMS[branchName]
    if (!items) continue
    for (const item of items) {
      await prisma.stockItem.upsert({
        where: { branchId_name: { branchId, name: item.name } },
        update: {},
        create: {
          branchId,
          name: item.name,
          code: item.code,
          type: item.type,
          sortOrder: item.sortOrder,
          isActive: true,
        },
      })
    }
    console.log(`  ✓ ${items.length} stock items seeded for ${branchName}`)
  }
}
