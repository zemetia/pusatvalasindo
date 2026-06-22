/**
 * One-time script to fix incorrect permission IDs in the custom_role table.
 *
 * Background: role-sheet.tsx was previously using old-style IDs like
 * "view_dashboard", "manage_users" instead of the canonical
 * "dashboard.view", "users.manage" format. Roles created via the UI
 * ended up with wrong permission strings, causing the sidebar menus to
 * not appear.
 *
 * This script:
 *  1. Loads all custom_role records.
 *  2. Replaces any old-style permission IDs with the correct ones.
 *  3. For roles whose name matches the ROLE_PERMISSION_MAP, re-applies
 *     the full canonical permission set.
 *  4. Skips roles that already have only valid permission IDs.
 *
 * Usage:
 *   npx tsx prisma/fix-permissions.ts
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
config()
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import { PERMISSIONS, getPermissionsForRole } from '../src/lib/permissions'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const VALID_IDS = new Set(Object.values(PERMISSIONS))

// Map of old UI-generated IDs → correct canonical IDs
const LEGACY_MAP: Record<string, string> = {
  view_dashboard: PERMISSIONS.DASHBOARD_VIEW,
  manage_users: PERMISSIONS.USERS_MANAGE,
  manage_branches: PERMISSIONS.BRANCHES_MANAGE,
  manage_roles: PERMISSIONS.ROLES_MANAGE,
  manage_stock: PERMISSIONS.STOCK_MANAGE,
  manage_kpi: PERMISSIONS.KPI_MANAGE,
  view_reports: PERMISSIONS.PAYROLL_VIEW_ALL,
}

function fixPermissions(roleName: string, current: string[]): string[] | null {
  // If all IDs are already valid → no change needed
  if (current.length > 0 && current.every((p) => VALID_IDS.has(p as never))) {
    return null
  }

  // If this role name is in our canonical map, use that authoritatively
  const canonical = getPermissionsForRole(roleName)
  if (canonical.length > 0) {
    return canonical
  }

  // Otherwise try to remap individual legacy IDs
  const fixed = current
    .map((p) => (VALID_IDS.has(p as never) ? p : (LEGACY_MAP[p] ?? null)))
    .filter((p): p is string => p !== null)

  return fixed.length !== current.length || fixed.some((p, i) => p !== current[i])
    ? fixed
    : null
}

async function main() {
  console.log('🔍 Scanning custom_role records...')
  const roles = await prisma.custom_role.findMany()
  let fixed = 0
  let skipped = 0

  for (const role of roles) {
    const updated = fixPermissions(role.name, role.permissions)
    if (updated === null) {
      console.log(`  ✓ [OK]    ${role.name} (${role.permissions.length} perms)`)
      skipped++
    } else {
      await prisma.custom_role.update({
        where: { id: role.id },
        data: { permissions: updated },
      })
      console.log(`  ✏️  [FIXED] ${role.name}: ${role.permissions.length} → ${updated.length} perms`)
      fixed++
    }
  }

  console.log(`\n✅ Done. Fixed: ${fixed}, Skipped (already OK): ${skipped}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
