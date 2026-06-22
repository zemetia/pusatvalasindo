import type { PrismaClient } from '../../src/generated/prisma/client'
import * as XLSX from 'xlsx'
import * as path from 'path'
import { getPermissionsForRole } from '../../src/lib/permissions'

// Setiap perusahaan wajib memiliki seluruh role standar ini,
// terlepas dari apa yang ada di sheet Excel.
const CANONICAL_ROLES = [
  'Kepala Cabang',
  'Kepala Marketing',
  'Teller Dalam',
  'Teller Luar',
  'Sales & Compliance',
  'Kurir',
]

export async function seedRoles(prisma: PrismaClient, companyIds: Record<string, string>) {
  console.log('  🗑️ Cleaning up old roles and matrices...')
  await prisma.roleKpi.deleteMany()
  await prisma.bonusMatrix.deleteMany()
  await prisma.custom_role.deleteMany()

  // ── 1. Baca roles dari Excel (bonus matrix per sheet) ──────────────────────
  const filePath = path.join(process.cwd(), 'docs/PVI Data/PERHITUNGAN KOMISI KPI_.xlsx')
  const workbook = XLSX.readFile(filePath)

  const sheetMapping: Record<string, string> = {
    'MATRIK BONUS KPI ': 'PVI',
    'MATRIK BONUS  pusat tukar uang': 'PTU',
    'MATRIX PUSAT KIRIM DUIT': 'PKD',
  }

  const formatRoleName = (name: string) =>
    name
      .split(' ')
      .map((word) => {
        const lower = word.toLowerCase()
        if (lower === 'dan' || lower === 'and') return '&'
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      })
      .join(' ')

  // rolesFromExcel[companyCode] = Set<roleName>
  const rolesFromExcel: Record<string, Set<string>> = {}

  for (const [sheetName, companyCode] of Object.entries(sheetMapping)) {
    rolesFromExcel[companyCode] = new Set()

    const sheet = workbook.Sheets[sheetName]
    if (!sheet) {
      console.warn(`  ! Sheet not found: ${sheetName}`)
      continue
    }

    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][]
    data.forEach((row) => {
      if (!row || row.length === 0) return
      const firstCell = row[0]
      if (
        typeof firstCell === 'string' &&
        firstCell.trim() !== '' &&
        !firstCell.toLowerCase().includes('matrix') &&
        !firstCell.toLowerCase().includes('note')
      ) {
        rolesFromExcel[companyCode].add(formatRoleName(firstCell.trim()))
      }
    })
  }

  // ── 2. Gabungkan dengan canonical roles dan upsert ─────────────────────────
  for (const [companyCode, companyId] of Object.entries(companyIds)) {
    const fromExcel = rolesFromExcel[companyCode] ?? new Set<string>()
    const allRoles  = new Set([...fromExcel, ...CANONICAL_ROLES])

    const roleList = [...allRoles].sort()
    console.log(`  🌱 Roles for ${companyCode} (${roleList.length}): ${roleList.join(', ')}`)

    for (const roleName of roleList) {
      const permissions = getPermissionsForRole(roleName)
      await prisma.custom_role.upsert({
        where: { name_companyId: { name: roleName, companyId } },
        update: { permissions },
        create: { name: roleName, companyId, permissions },
      })
    }
  }

  // ── 3. Pastikan role sistem global (companyId = null) juga fresh ───────────
  for (const sysRole of ['SUPER_ADMIN', 'OWNER']) {
    const permissions = getPermissionsForRole(sysRole)
    const existing = await prisma.custom_role.findFirst({ where: { name: sysRole, companyId: null } })
    if (existing) {
      await prisma.custom_role.update({ where: { id: existing.id }, data: { permissions } })
    } else {
      await prisma.custom_role.create({ data: { name: sysRole, companyId: null, permissions } })
    }
    console.log(`  ✓ System role: ${sysRole}`)
  }
}
