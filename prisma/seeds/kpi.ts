import type { PrismaClient } from '../../src/generated/prisma/client'

const KPI_DEFINITIONS = [
  { name: 'Kehadiran & Kedisiplinan', type: 'EVENT' },
  { name: 'Kesesuaian SOP', type: 'EVENT' },
  { name: 'Jumlah Omzet', type: 'TARGET' },
  { name: 'Kepuasan Nasabah', type: 'TARGET' },
  { name: 'Revenue', type: 'TARGET' },
  { name: 'Kesesuaian Jumlah Kas', type: 'EVENT' },
  { name: 'Kesesuaian Pengarsipan Berkas', type: 'EVENT' },
  { name: 'Kebersihan & Kerapihan Booth', type: 'EVENT' },
  { name: 'Ketelitian Perhitungan', type: 'EVENT' },
  { name: 'Update Kurs', type: 'EVENT' },
  { name: 'Complain Nasabah', type: 'EVENT' },
  { name: 'Laporan Compliance Tepat Waktu', type: 'EVENT' },
  { name: 'Laporan & Rekonsiliasi Tepat Waktu', type: 'EVENT' },
  { name: 'Closing Tepat Waktu', type: 'EVENT' },
  { name: 'Net Profit Margin', type: 'TARGET' },
  { name: 'Laporan Serah Terima Barang Tepat Waktu', type: 'EVENT' },
  { name: 'Ketepatan Waktu & Jumlah Pengiriman', type: 'TARGET' },
  { name: 'Ketersediaan Stok Mata Uang', type: 'TARGET' },
  { name: 'Efisiensi Pelaporan & Monitoring', type: 'EVENT' },
  { name: 'Efisiensi Pelaporan & Monitoring Kurs', type: 'EVENT' },
  { name: 'Kepatuhan Regulasi SOP', type: 'EVENT' },
  { name: 'Resiko Likuiditas', type: 'EVENT' },
  { name: 'Team Management', type: 'EVENT' },
]

const PVI_KASIR_KPIS = [
  { name: 'Jumlah Omzet', weight: 0.35, target: 10000000000, threshold: undefined },
  { name: 'Kesesuaian SOP', weight: 0.15, target: undefined, threshold: 100 },
  { name: 'Kehadiran & Kedisiplinan', weight: 0.20, target: undefined, threshold: 100 },
]

const PVI_KASIR_BONUS_TIERS = [
  { min: 0.8, max: 1.0, type: 'BONUS_CASH', amount: 250000 },
  { min: 0.6, max: 0.79, type: 'SAFE_ZONE', amount: 0 },
  { min: 0.1, max: 0.59, type: 'PENALTY_DEDUCTION', amount: -150000 },
]

export async function seedKpi(
  prisma: PrismaClient,
  companyIds: Record<string, string>
): Promise<void> {
  console.log('  🗑️ Cleaning up old KPI data...')
  await prisma.roleKpi.deleteMany()
  await prisma.kpiLog.deleteMany()
  await prisma.kpiDefinition.deleteMany()
  
  const kpiIds: Record<string, string> = {}
  for (const def of KPI_DEFINITIONS) {
    const kpi = await prisma.kpiDefinition.upsert({
      where: { id: `def_${def.name.toLowerCase().replace(/ /g, '_')}` },
      update: { type: def.type as any },
      create: {
        id: `def_${def.name.toLowerCase().replace(/ /g, '_')}`,
        name: def.name,
        type: def.type as any,
      },
    })
    kpiIds[def.name] = kpi.id
  }
  console.log(`  ✓ ${KPI_DEFINITIONS.length} KPI definitions seeded`)
/*
  const pviId = companyIds['PVI']
  for (const kpi of PVI_KASIR_KPIS) {
    await prisma.roleKpi.upsert({
      where: { companyId_roleName_kpiId: { companyId: pviId, roleName: 'KASIR', kpiId: kpiIds[kpi.name] } },
      update: { weight: kpi.weight, targetValue: kpi.target, threshold: kpi.threshold, maxScore: 100 },
      create: {
        companyId: pviId,
        roleName: 'KASIR',
        kpiId: kpiIds[kpi.name],
        weight: kpi.weight,
        targetValue: kpi.target,
        threshold: kpi.threshold,
        maxScore: 100,
      },
    })
  }
  console.log(`  ✓ ${PVI_KASIR_KPIS.length} role KPIs seeded for PVI KASIR`)

  const matrix = await prisma.bonusMatrix.upsert({
    where: { companyId_roleName: { companyId: pviId, roleName: 'KASIR' } },
    update: {},
    create: { companyId: pviId, roleName: 'KASIR' },
  })

  for (const t of PVI_KASIR_BONUS_TIERS) {
    const existing = await prisma.bonusTier.findFirst({
      where: { matrixId: matrix.id, resultType: t.type as any, minScore: t.min },
    })
    if (!existing) {
      await prisma.bonusTier.create({
        data: {
          matrixId: matrix.id,
          minScore: t.min,
          maxScore: t.max,
          resultType: t.type as any,
          amount: t.amount,
        },
      })
    }
  }
  console.log(`  ✓ Bonus matrix + ${PVI_KASIR_BONUS_TIERS.length} tiers seeded for PVI KASIR`)
*/
}
