// ═══════════════════════════════════════════════════════════════════════════
// Benih rule reward/denda slip gaji ke tabel PayrollRule + PayrollRuleTier.
//
// Rule TINGGAL DI DATABASE. Data di pvi.ts / ptu.ts / pkd.ts / umum.ts hanya
// isi awal untuk database yang masih kosong; sesudah terisi, HR menyuntingnya
// lewat halaman "Rule Reward & Denda". Karena itu seeder ini SENGAJA hanya
// membuat rule yang `ruleKey`-nya belum ada: menjalankan ulang seed tidak
// boleh menimpa rule yang sudah disunting HR, dan tidak boleh membuat versi
// baru tanpa ada yang memutuskannya.
//
// Dua hal dipinjam langsung dari engine, bukan disalin ulang:
//   • signRule    — supaya tanda tangan benih identik dengan tanda tangan yang
//                   dihasilkan aplikasi. Salinan yang menyimpang membuat rule
//                   hasil seed ditolak engine tanpa alasan yang jelas.
//   • validateRule — supaya rule yang cacat GAGAL DI SEED, bukan baru ketahuan
//                   saat payroll berjalan.
// Keduanya tidak memakai alias `@/`, jadi aman diimpor dari tsx.
// ═══════════════════════════════════════════════════════════════════════════

import type { Prisma, PrismaClient } from '../../../src/generated/prisma/client'
import { hasSigningKey, signRule } from '../../../src/backend/payroll-rules/signature'
import { validateRule } from '../../../src/backend/payroll-rules/validate'
import { UMUM_RULES } from './umum'
import { PVI_RULES } from './pvi'
import { PTU_RULES } from './ptu'
import { PKD_RULES } from './pkd'
import { TOP_PERFORMER_RULES } from './top-performer'
import { OMZET_TIM_RULES } from './omzet-tim'
import type { RuleSeed } from './types'

const ALL_RULES: RuleSeed[] = [
  ...UMUM_RULES,
  ...PVI_RULES,
  ...PTU_RULES,
  ...PKD_RULES,
  ...TOP_PERFORMER_RULES,
  ...OMZET_TIM_RULES,
]

const MODE = { agregat: 'AGREGAT', per_baris: 'PER_BARIS' } as const

/**
 * Dua rule dengan `ruleKey` sama akan saling menimpa tanpa error — yang kedua
 * dilewati diam-diam karena yang pertama sudah ada di database. Diperiksa di
 * sini supaya ketahuan saat seed, bukan saat ada yang bertanya kenapa rule-nya
 * tidak jalan.
 */
function auditDuplicateKeys(): string[] {
  const seen = new Set<string>()
  const dupes = new Set<string>()
  for (const r of ALL_RULES) {
    if (seen.has(r.ruleKey)) dupes.add(r.ruleKey)
    seen.add(r.ruleKey)
  }
  return [...dupes]
}

/**
 * Bentuk yang dimengerti validator engine. Validator bekerja pada bentuk
 * spesifikasi (`tier_field`, `per_unit`, `for`, …) sementara data benih memakai
 * penamaan database (`tierField`, `perUnit`, `targets`, …) — satu-satunya
 * tempat kedua penamaan itu bertemu adalah di sini.
 */
function toSpecShape(r: RuleSeed) {
  return {
    id: r.ruleKey,
    versi: 1,
    berlaku_dari: r.effectiveFrom,
    berlaku_sampai: r.effectiveTo ?? null,
    mode: r.mode,
    query: { sql: r.sql, expect: r.mode === 'agregat' ? 'one_row' : 'many_rows' },
    konstanta: r.constants,
    guard: r.guards,
    tier_field: r.tierField,
    tiers: r.tiers.map((t) => ({
      min: t.min,
      max: t.max,
      nominal: t.nominal,
      per_unit: t.perUnit,
      unit_field: t.unitField,
      formula: t.formula,
      label: t.label,
      mandatory_saturday: t.mandatorySaturday,
      warning_letter: t.warningLetter,
    })),
    default: r.defaults,
    for: r.targets,
    except: r.excepts,
  }
}

export async function seedPayrollRules(prisma: PrismaClient) {
  console.log('🌱 Seeding rule reward/denda slip gaji...')

  const dupes = auditDuplicateKeys()
  if (dupes.length > 0) {
    throw new Error(
      `ruleKey ganda pada data benih: ${dupes.join(', ')}. ` +
        'Yang kedua tidak akan pernah terpakai — perbaiki dulu sebelum seed dijalankan.'
    )
  }

  if (!hasSigningKey()) {
    console.warn(
      '  ⚠ PAYROLL_RULE_SIGNING_KEY belum diset — impor rule DILEWATI SELURUHNYA. ' +
        'Rule tanpa tanda tangan ditolak engine, jadi lebih baik tidak dibuat sama sekali. ' +
        'Akibatnya: payroll tidak akan menghasilkan bonus/denda apa pun sampai kunci diisi ' +
        'dan seed dijalankan ulang.'
    )
    return
  }

  // Validasi dulu SELURUHNYA, baru menulis. Kalau ada satu rule cacat, lebih
  // baik tidak ada yang masuk daripada database terisi separuh.
  const invalid: string[] = []
  for (const r of ALL_RULES) {
    const outcome = validateRule(toSpecShape(r), `${r.ruleKey} (benih)`)
    if (outcome.errors.length > 0) invalid.push(`${r.ruleKey}: ${outcome.errors.join('; ')}`)
    outcome.warnings.forEach((w) => console.warn(`  ⚠ ${w}`))
  }
  if (invalid.length > 0) {
    throw new Error(`${invalid.length} rule benih tidak lolos validasi:\n  - ${invalid.join('\n  - ')}`)
  }

  let created = 0
  const skipped: string[] = []

  for (const r of ALL_RULES) {
    const existing = await prisma.payrollRule.findFirst({ where: { ruleKey: r.ruleKey } })
    if (existing) {
      skipped.push(r.ruleKey)
      continue
    }

    const tiers = r.tiers.map((t, i) => ({
      sortOrder: i,
      min: t.min ?? null,
      max: t.max ?? null,
      nominal: t.nominal ?? null,
      perUnit: t.perUnit ?? null,
      formula: t.formula ?? null,
      unitField: t.unitField ?? null,
      label: t.label,
      mandatorySaturday: t.mandatorySaturday ?? false,
      warningLetter: t.warningLetter ?? false,
    }))

    const effectiveFrom = new Date(`${r.effectiveFrom}T00:00:00Z`)
    const effectiveTo = r.effectiveTo ? new Date(`${r.effectiveTo}T00:00:00Z`) : null

    const signature = signRule({
      ruleKey: r.ruleKey,
      version: 1,
      effectiveFrom,
      effectiveTo,
      mode: MODE[r.mode],
      sql: r.sql,
      tierField: r.tierField,
      constants: r.constants ?? null,
      guards: r.guards ?? null,
      defaults: r.defaults ?? null,
      targets: r.targets ?? null,
      excepts: r.excepts ?? null,
      tiers,
    })

    await prisma.payrollRule.create({
      data: {
        ruleKey: r.ruleKey,
        version: 1,
        effectiveFrom,
        effectiveTo,
        mode: MODE[r.mode],
        sql: r.sql,
        tierField: r.tierField,
        constants: (r.constants ?? undefined) as Prisma.InputJsonValue | undefined,
        guards: (r.guards ?? undefined) as Prisma.InputJsonValue | undefined,
        // Prisma mengetik kolom Json sebagai objek; `targets`/`excepts` adalah
        // array — sah sebagai JSON, tapi butuh cast supaya lolos tipe.
        defaults: r.defaults as Prisma.InputJsonValue,
        targets: r.targets as unknown as Prisma.InputJsonValue,
        excepts: (r.excepts ?? undefined) as unknown as Prisma.InputJsonValue | undefined,
        note: r.note ?? null,
        changeNote: 'Isi awal dari benih seeder.',
        signature,
        tiers: { create: tiers },
      },
    })
    created++
  }

  console.log(
    `  ✓ ${created} rule dibuat dari ${ALL_RULES.length} benih` +
      (skipped.length > 0 ? ` · ${skipped.length} sudah ada di database dan dibiarkan` : '')
  )
  if (skipped.length > 0) {
    console.log(`    dilewati: ${skipped.join(', ')}`)
  }
}
