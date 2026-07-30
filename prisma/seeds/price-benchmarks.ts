import type { PrismaClient } from '../../src/generated/prisma/client'
import { SMARTDEAL_CURRENCIES } from '../../src/lib/smartdeal-currencies'

// Penyesuaian patokan harga per mata uang, sumber: pvi_adjustments.json.
// Angka = offset nominal (0 = tanpa penyesuaian), string = ekspresi mentah
// yang sudah sesuai grammar src/lib/price-adjustment.ts (mis. "c5", "c0.05").
type RawAdjustment = number | string

const ADJUSTMENTS: Record<string, { buy: RawAdjustment; sell: RawAdjustment }> = {
  USD: { buy: 30, sell: -5 },
  SGD: { buy: 10, sell: 0 },
  HKD: { buy: 5, sell: 5 },
  MYR: { buy: 10, sell: 5 },
  THB: { buy: 1, sell: 0 },
  CNY: { buy: 'c5', sell: 'c5' },
  TWD: { buy: 1, sell: 1 },
  KRW: { buy: 'c0.05', sell: 'c0.05' },
  AUD: { buy: 10, sell: 5 },
  JPY: { buy: 0.3, sell: 0 },
  EUR: { buy: 10, sell: -5 },
  GBP: { buy: 15, sell: -5 },
  NZD: { buy: 20, sell: -5 },
  CAD: { buy: 20, sell: -5 },
  CHF: { buy: 15, sell: -5 },
  SAR: { buy: 'c5', sell: 'c5' },
  AED: { buy: 0, sell: 0 },
  QAR: { buy: 0, sell: 0 },
  OMR: { buy: -200, sell: 0 },
  BHD: { buy: -200, sell: 0 },
  KWD: { buy: -200, sell: 0 },
  JOD: { buy: -200, sell: 0 },
  INR: { buy: 0, sell: 0 },
  PHP: { buy: 0, sell: 0 },
  VND: { buy: -0.02, sell: 0 },
  TRY: { buy: 15, sell: 0 },
  BND: { buy: 20, sell: 0 },
  SEK: { buy: -20, sell: 0 },
  NOK: { buy: -20, sell: 0 },
  DKK: { buy: -20, sell: 0 },
  RUB: { buy: -20, sell: 0 },
  IQD: { buy: -1, sell: 0 },
  ZAR: { buy: -20, sell: 0 },
  MOP: { buy: -20, sell: 0 },
}

/**
 * Angka mentah -> ekspresi penyesuaian bertanda ("+30", "-0.02"); 0 berarti
 * tanpa penyesuaian sehingga disimpan sebagai string kosong. String dipakai
 * apa adanya (sudah berupa ekspresi rounding).
 */
function toExpression(value: RawAdjustment): string {
  if (typeof value === 'string') return value.trim()
  if (!Number.isFinite(value) || value === 0) return ''
  return value > 0 ? `+${value}` : `${value}`
}

export async function seedPriceBenchmarks(prisma: PrismaClient) {
  const nameByCode = new Map(SMARTDEAL_CURRENCIES.map((c) => [c.code, c.name]))

  for (const [code, raw] of Object.entries(ADJUSTMENTS)) {
    const data = {
      name: nameByCode.get(code) ?? code,
      sellAdjustment: toExpression(raw.sell),
      buyAdjustment: toExpression(raw.buy),
    }

    await prisma.priceBenchmark.upsert({
      where: { code },
      update: data,
      create: { code, ...data },
    })
  }

  console.log(`   ✓ ${Object.keys(ADJUSTMENTS).length} patokan harga`)
}
