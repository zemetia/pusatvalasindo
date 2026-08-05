import { Prisma, type PrismaClient } from '../../../src/generated/prisma/client'
import { PVI_ROLE_KPIS } from './pvi'
import { PTU_ROLE_KPIS } from './ptu'
import { PKD_ROLE_KPIS } from './pkd'
import type { RoleBlock } from './types'

/**
 * Penerapan KPI ke tiap jabatan per PT, lengkap dengan bobot dan parameter
 * penilaiannya. Angkanya tinggal di file per PT (pvi.ts / ptu.ts / pkd.ts);
 * file ini hanya menyatukan, memeriksa, dan menulisnya ke database.
 *
 * Catatan yang perlu diketahui saat membaca angka di file-file itu:
 *  - `pointPerUnit` untuk KPI PENALTY_POINT adalah poin yang hilang per kejadian;
 *    untuk PENALTY_PERCENT adalah persen yang hilang per kejadian.
 *  - KPI yang sama bisa punya beban berbeda antar jabatan — mis. komplain
 *    nasabah 3 poin untuk Marketing tapi 5 poin (setara −5%) untuk Kepala
 *    Marketing, persis seperti di sheet aslinya.
 *  - Bobot yang tidak berjumlah 100% tidak dirapikan diam-diam; `auditWeights`
 *    di bawah menyuarakannya setiap kali seed jalan.
 */
export const ROLE_BLOCKS: RoleBlock[] = [
  ...PVI_ROLE_KPIS,
  ...PTU_ROLE_KPIS,
  ...PKD_ROLE_KPIS,
]

/**
 * Total bobot tiap jabatan harus 100%.
 *
 * Engine memang menormalkan dengan total bobot supaya karyawan tidak dirugikan
 * konfigurasi yang belum rapi, tapi justru itu yang membuat bobot meleset bisa
 * lolos tanpa disadari — persis yang terjadi pada sheet aslinya. Pemeriksaan ini
 * membuatnya terlihat setiap kali seed dijalankan.
 */
function auditWeights(): string[] {
  const problems: string[] = []
  for (const block of ROLE_BLOCKS) {
    const total = Math.round(block.kpis.reduce((sum, k) => sum + k.weight, 0) * 100)
    if (total !== 100) {
      problems.push(`${block.company} / ${block.role}: total bobot ${total}% (seharusnya 100%)`)
    }
  }
  return problems
}

/**
 * Satu jabatan hanya boleh muncul sekali. Sejak blok per PT dipisah ke tiga
 * file, jabatan yang sama bisa tanpa sengaja ditulis di dua file — dan karena
 * penulisannya `upsert`, blok terakhir akan menimpa yang pertama tanpa error.
 */
function auditDuplicates(): string[] {
  const seen = new Set<string>()
  const duplicates: string[] = []
  for (const block of ROLE_BLOCKS) {
    const key = `${block.company} / ${block.role}`
    if (seen.has(key)) duplicates.push(key)
    seen.add(key)
  }
  return duplicates
}

export async function seedRoleKpis(
  prisma: PrismaClient,
  companyIds: Record<string, string>
) {
  console.log('🌱 Seeding penerapan KPI per jabatan...')

  const duplicates = auditDuplicates()
  if (duplicates.length > 0) {
    console.warn(`  ⚠ Jabatan ganda antar file PT (blok terakhir menimpa yang pertama):`)
    duplicates.forEach((d) => console.warn(`    - ${d}`))
  }

  const weightProblems = auditWeights()
  if (weightProblems.length > 0) {
    console.warn(`  ⚠ ${weightProblems.length} jabatan bobotnya tidak 100%:`)
    weightProblems.forEach((p) => console.warn(`    - ${p}`))
  }

  const roles = await prisma.custom_role.findMany({ select: { id: true, name: true, companyId: true } })
  const kpiDefs = await prisma.kpiDefinition.findMany({ select: { id: true, code: true } })

  const roleLookup = new Map(roles.map((r) => [`${r.companyId}_${r.name}`, r.id]))
  const kpiLookup = new Map(kpiDefs.map((k) => [k.code, k.id]))

  let count = 0
  const skipped: string[] = []

  for (const block of ROLE_BLOCKS) {
    const companyId = companyIds[block.company]
    const roleId = roleLookup.get(`${companyId}_${block.role}`)

    if (!companyId || !roleId) {
      skipped.push(`${block.company} / ${block.role} (jabatan tidak ditemukan)`)
      continue
    }

    for (const item of block.kpis) {
      const kpiId = kpiLookup.get(item.kpi)
      if (!kpiId) {
        skipped.push(`${block.company} / ${block.role} / ${item.kpi} (definisi tidak ditemukan)`)
        continue
      }

      const data = {
        weight: item.weight,
        targetValue: item.targetValue ?? null,
        basePoint: item.basePoint ?? null,
        pointPerUnit: item.pointPerUnit ?? null,
        toleranceLimit: item.toleranceLimit ?? null,
        toleranceScope: item.toleranceScope ?? null,
        inputSource: item.inputSource ?? null,
        // Prisma menuntut sentinel DbNull untuk mengosongkan kolom Json,
        // bukan null biasa.
        systemConfig: item.systemConfig ?? Prisma.DbNull,
        isActive: true,
      }

      await prisma.roleKpi.upsert({
        where: {
          companyId_customRoleId_kpiId: { companyId, customRoleId: roleId, kpiId },
        },
        update: data,
        create: { companyId, customRoleId: roleId, kpiId, ...data },
      })
      count++
    }
  }

  console.log(
    `  ✓ ${count} penerapan KPI per jabatan di-seed` +
      (weightProblems.length === 0 ? ' · seluruh bobot jabatan genap 100%' : '')
  )
  if (skipped.length > 0) {
    console.warn(`  ! ${skipped.length} dilewati:`)
    skipped.forEach((s) => console.warn(`    - ${s}`))
  }
}
