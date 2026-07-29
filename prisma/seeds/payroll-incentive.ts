import type { PrismaClient } from '../../src/generated/prisma/client'

/**
 * Matriks insentif payroll — terjemahan sheet "MATRIX BONUS" di
 * docs/PVI Data/PERHITUNGAN KOMISI KPI_.xlsx.
 *
 * Ini bagian payroll, bukan KPI: modul KPI hanya menghasilkan skor, lalu
 * payroll-incentive.service memetakan skor itu ke rupiah.
 *
 * Rentang skor disimpan sebagai rasio (0.8 = 80%). Tier dicocokkan dari
 * minScore tertinggi lebih dulu, sehingga rentang ">120%" menang atas
 * rentang di bawahnya ketika keduanya cocok.
 */

type TierSeed = {
  min: number
  max: number
  outcome: 'BONUS_CASH' | 'SAFE_ZONE' | 'DEDUCTION' | 'TOP_PERFORMER'
  cash?: number
  mandatorySaturday?: boolean
  topRank?: number
  note?: string
}

type MatrixSeed = {
  company: 'PVI' | 'PTU' | 'PKD'
  role: string
  tiers: TierSeed[]
}

const MATRICES: MatrixSeed[] = [
  // ── PUSAT VALAS INDO ─────────────────────────────────────────────────────
  {
    company: 'PVI',
    role: 'Marketing',
    tiers: [
      { min: 0.8, max: 1.0, outcome: 'BONUS_CASH', cash: 250_000 },
      { min: 0.7, max: 0.79, outcome: 'SAFE_ZONE' },
      { min: 0.1, max: 0.69, outcome: 'DEDUCTION', cash: 0, mandatorySaturday: true },
      { min: 0, max: 10, outcome: 'TOP_PERFORMER', cash: 500_000, topRank: 1, note: 'Top 1 sales' },
    ],
  },
  {
    company: 'PVI',
    role: 'Teller Luar',
    tiers: [
      { min: 0.8, max: 1.0, outcome: 'BONUS_CASH', cash: 250_000 },
      { min: 0.6, max: 0.79, outcome: 'SAFE_ZONE' },
      { min: 0.1, max: 0.59, outcome: 'DEDUCTION', cash: 150_000, mandatorySaturday: true },
      { min: 0, max: 10, outcome: 'TOP_PERFORMER', cash: 500_000, topRank: 1, note: 'Teller terbaik' },
    ],
  },
  {
    company: 'PVI',
    role: 'Teller Dalam',
    tiers: [
      { min: 1.2, max: 10, outcome: 'BONUS_CASH', cash: 1_500_000 },
      { min: 1.01, max: 1.2, outcome: 'BONUS_CASH', cash: 1_000_000 },
      { min: 0.8, max: 1.0, outcome: 'BONUS_CASH', cash: 500_000 },
      { min: 0.6, max: 0.79, outcome: 'SAFE_ZONE' },
      { min: 0.1, max: 0.59, outcome: 'DEDUCTION', cash: 300_000, mandatorySaturday: true },
    ],
  },
  {
    company: 'PVI',
    role: 'Kurir',
    tiers: [
      { min: 0.8, max: 1.0, outcome: 'BONUS_CASH', cash: 250_000 },
      { min: 0.6, max: 0.79, outcome: 'SAFE_ZONE' },
      { min: 0.1, max: 0.59, outcome: 'DEDUCTION', cash: 0, mandatorySaturday: true },
      { min: 0, max: 10, outcome: 'TOP_PERFORMER', cash: 500_000, topRank: 1, note: 'Kurir terbaik' },
    ],
  },
  {
    company: 'PVI',
    role: 'Kepala Cabang',
    tiers: [
      { min: 1.2, max: 10, outcome: 'BONUS_CASH', cash: 1_250_000 },
      { min: 1.0, max: 1.2, outcome: 'BONUS_CASH', cash: 750_000 },
      { min: 0.8, max: 0.99, outcome: 'BONUS_CASH', cash: 500_000 },
      { min: 0.6, max: 0.79, outcome: 'SAFE_ZONE' },
      { min: 0.1, max: 0.59, outcome: 'DEDUCTION', cash: 300_000 },
    ],
  },
  {
    company: 'PVI',
    role: 'Kepala Marketing',
    tiers: [
      { min: 0.8, max: 0.99, outcome: 'BONUS_CASH', cash: 500_000 },
      { min: 0.6, max: 0.79, outcome: 'SAFE_ZONE' },
      { min: 0.1, max: 0.59, outcome: 'DEDUCTION', cash: 200_000 },
    ],
  },

  // ── PUSAT TUKAR UANG ─────────────────────────────────────────────────────
  {
    company: 'PTU',
    role: 'Teller Luar',
    tiers: [
      { min: 0.8, max: 1.0, outcome: 'BONUS_CASH', cash: 250_000 },
      { min: 0.6, max: 0.79, outcome: 'SAFE_ZONE' },
      { min: 0.1, max: 0.59, outcome: 'DEDUCTION', cash: 150_000, mandatorySaturday: true },
      { min: 0, max: 10, outcome: 'TOP_PERFORMER', cash: 500_000, topRank: 1, note: 'Teller terbaik' },
    ],
  },
  {
    company: 'PTU',
    role: 'Teller Dalam',
    tiers: [
      { min: 1.2, max: 10, outcome: 'BONUS_CASH', cash: 1_500_000 },
      { min: 1.01, max: 1.2, outcome: 'BONUS_CASH', cash: 1_000_000 },
      { min: 0.8, max: 1.0, outcome: 'BONUS_CASH', cash: 250_000 },
      { min: 0.6, max: 0.79, outcome: 'SAFE_ZONE' },
      { min: 0.1, max: 0.59, outcome: 'DEDUCTION', cash: 300_000, mandatorySaturday: true },
    ],
  },
  {
    company: 'PTU',
    role: 'Kepala Cabang',
    tiers: [
      { min: 0.8, max: 1.0, outcome: 'BONUS_CASH', cash: 500_000 },
      { min: 0.6, max: 0.79, outcome: 'SAFE_ZONE' },
      { min: 0.1, max: 0.59, outcome: 'DEDUCTION', cash: 300_000 },
    ],
  },

  // ── PUSAT KIRIM DUIT ─────────────────────────────────────────────────────
  {
    company: 'PKD',
    role: 'Marketing',
    tiers: [
      { min: 0.8, max: 1.0, outcome: 'BONUS_CASH', cash: 250_000 },
      { min: 0.7, max: 0.79, outcome: 'SAFE_ZONE' },
      { min: 0.1, max: 0.69, outcome: 'DEDUCTION', cash: 0, mandatorySaturday: true },
      { min: 0, max: 10, outcome: 'TOP_PERFORMER', cash: 500_000, topRank: 1, note: 'Top 1 sales' },
    ],
  },
  {
    company: 'PKD',
    role: 'Kepala Cabang',
    tiers: [
      { min: 1.2, max: 10, outcome: 'BONUS_CASH', cash: 1_500_000 },
      { min: 1.0, max: 1.2, outcome: 'BONUS_CASH', cash: 1_000_000 },
      { min: 0.8, max: 0.99, outcome: 'BONUS_CASH', cash: 500_000 },
      { min: 0.7, max: 0.79, outcome: 'SAFE_ZONE' },
      { min: 0.1, max: 0.69, outcome: 'DEDUCTION', cash: 500_000 },
    ],
  },
]

export async function seedPayrollIncentives(
  prisma: PrismaClient,
  companyIds: Record<string, string>
) {
  console.log('🌱 Seeding matriks insentif payroll...')

  await prisma.payrollIncentiveMatrix.deleteMany()

  const roles = await prisma.custom_role.findMany({ select: { id: true, name: true, companyId: true } })
  const roleLookup = new Map(roles.map((r) => [`${r.companyId}_${r.name}`, r.id]))

  let matrixCount = 0
  let tierCount = 0
  const skipped: string[] = []

  for (const m of MATRICES) {
    const companyId = companyIds[m.company]
    const roleId = roleLookup.get(`${companyId}_${m.role}`)

    if (!companyId || !roleId) {
      skipped.push(`${m.company} / ${m.role}`)
      continue
    }

    await prisma.payrollIncentiveMatrix.create({
      data: {
        companyId,
        customRoleId: roleId,
        name: `Matriks insentif ${m.role}`,
        tiers: {
          create: m.tiers.map((t) => ({
            minScore: t.min,
            maxScore: t.max,
            outcome: t.outcome,
            cashAmount: t.cash ?? null,
            mandatorySaturday: t.mandatorySaturday ?? false,
            topRank: t.topRank ?? null,
            note: t.note ?? null,
          })),
        },
      },
    })

    matrixCount++
    tierCount += m.tiers.length
  }

  console.log(`  ✓ ${matrixCount} matriks + ${tierCount} tier di-seed`)
  if (skipped.length > 0) {
    console.warn(`  ! Dilewati (jabatan tidak ditemukan): ${skipped.join(', ')}`)
  }
}
