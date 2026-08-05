import type { PrismaClient } from '../../../src/generated/prisma/client'
import { KPI_DEFINITIONS } from './definitions'

export { KPI_DEFINITIONS }
export type { KpiSeed } from './types'

/**
 * Satu `code` hanya boleh dipakai satu definisi. Sejak definisi dipecah per
 * tema, kode yang sama bisa tanpa sengaja ditulis di dua file — dan karena
 * penulisannya `upsert`, definisi terakhir menimpa yang pertama tanpa error.
 */
function auditDuplicateCodes(): string[] {
  const seen = new Set<string>()
  const duplicates: string[] = []
  for (const def of KPI_DEFINITIONS) {
    if (seen.has(def.code)) duplicates.push(def.code)
    seen.add(def.code)
  }
  return duplicates
}

export async function seedKpi(prisma: PrismaClient): Promise<void> {
  const duplicates = auditDuplicateCodes()
  if (duplicates.length > 0) {
    console.warn('  ⚠ Kode KPI ganda antar file tema (definisi terakhir menimpa yang pertama):')
    duplicates.forEach((c) => console.warn(`    - ${c}`))
  }

  console.log('  🗑️ Membersihkan data KPI lama...')
  // Entri ikut terhapus lewat cascade RoleKpi → KpiEntry.
  await prisma.roleKpi.deleteMany()
  await prisma.kpiDefinition.deleteMany()

  for (const def of KPI_DEFINITIONS) {
    await prisma.kpiDefinition.upsert({
      where: { code: def.code },
      update: {
        name: def.name,
        objective: def.objective ?? null,
        description: def.description,
        scoringType: def.scoringType,
        unit: def.unit,
        direction: def.direction ?? 'HIGHER_BETTER',
        defaultInputSource: def.defaultInputSource,
        defaultRequiresApproval: def.defaultRequiresApproval,
        defaultRequiresEvidence: def.defaultRequiresEvidence ?? false,
        systemSourceKey: def.systemSourceKey ?? null,
        isActive: true,
      },
      create: {
        code: def.code,
        name: def.name,
        objective: def.objective ?? null,
        description: def.description,
        scoringType: def.scoringType,
        unit: def.unit,
        direction: def.direction ?? 'HIGHER_BETTER',
        defaultInputSource: def.defaultInputSource,
        defaultRequiresApproval: def.defaultRequiresApproval,
        defaultRequiresEvidence: def.defaultRequiresEvidence ?? false,
        systemSourceKey: def.systemSourceKey ?? null,
      },
    })
  }

  console.log(`  ✓ ${KPI_DEFINITIONS.length} definisi KPI di-seed`)
}
