import type { PrismaClient, CompanyStockItemType } from '../../src/generated/prisma/client'

type CompanyStockItemDef = { name: string; code: string | null; type: CompanyStockItemType; sortOrder: number }

// Mata uang & logam mulia saja — tidak ada kas/bank di module ini.
const PVI_PTU_ITEMS: CompanyStockItemDef[] = [
  { name: 'LM SILVER', code: null, type: 'LOGAM_MULIA', sortOrder: 0 },
  { name: 'LM', code: null, type: 'LOGAM_MULIA', sortOrder: 1 },
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
]

const PKD_ITEMS: CompanyStockItemDef[] = [
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
]

const COMPANY_ITEMS: Record<string, CompanyStockItemDef[]> = {
  PVI: PVI_PTU_ITEMS,
  PTU: PVI_PTU_ITEMS,
  PKD: PKD_ITEMS,
}

export async function seedCompanyStockItems(
  prisma: PrismaClient,
  companyIds: Record<string, string>
): Promise<void> {
  for (const [companyCode, companyId] of Object.entries(companyIds)) {
    const items = COMPANY_ITEMS[companyCode]
    if (!items) continue
    for (const item of items) {
      await prisma.companyStockItem.upsert({
        where: { companyId_name: { companyId, name: item.name } },
        update: {},
        create: {
          companyId,
          name: item.name,
          code: item.code,
          type: item.type,
          sortOrder: item.sortOrder,
          isActive: true,
        },
      })
    }
    console.log(`  ✓ ${items.length} company stock items seeded for ${companyCode}`)
  }
}
