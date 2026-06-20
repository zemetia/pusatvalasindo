/**
 * One-shot script to backfill permissions on existing custom_role rows.
 * Run with: npx tsx prisma/scripts/sync-permissions.ts
 */
import prisma from "../../src/lib/prisma";
import { getPermissionsForRole } from "../../src/lib/permissions";

async function main() {
  const roles = await prisma.custom_role.findMany({
    select: { id: true, name: true, permissions: true },
  });

  let updated = 0;
  for (const role of roles) {
    const permissions = getPermissionsForRole(role.name);
    if (
      permissions.length !== role.permissions.length ||
      !permissions.every((p) => role.permissions.includes(p))
    ) {
      await prisma.custom_role.update({
        where: { id: role.id },
        data: { permissions },
      });
      console.log(`✓ ${role.name}: ${permissions.join(", ")}`);
      updated++;
    } else {
      console.log(`– ${role.name}: already up-to-date`);
    }
  }

  console.log(`\nDone. ${updated} role(s) updated.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
