import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const companies = await prisma.company.findMany({ select: { id: true, code: true, name: true } });
  console.log("=== COMPANIES ===");
  console.table(companies);

  const roles = await prisma.custom_role.findMany({
    select: {
      id: true,
      name: true,
      companyId: true,
      usesResourcePerms: true,
      permissions: true,
      _count: { select: { resourcePerms: true } },
    },
    orderBy: [{ companyId: "asc" }, { name: "asc" }],
  });
  console.log("=== ROLES ===");
  console.table(
    roles.map((r) => ({
      name: r.name,
      companyId: r.companyId,
      migrated: r.usesResourcePerms,
      grants: r._count.resourcePerms,
      legacyPerms: r.permissions.length,
    }))
  );

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,

      customRole: { select: { name: true, companyId: true, usesResourcePerms: true } },
      branch: { select: { name: true, companyId: true } },
    },
    orderBy: { email: "asc" },
  });
  console.log("=== USERS ===");
  console.table(
    users.map((u) => ({
      email: u.email,

      customRole: u.customRole?.name ?? "-",
      migrated: u.customRole?.usesResourcePerms ?? "-",
      branch: u.branch?.name ?? "-",
      branchCompany: u.branch?.companyId ?? "-",
    }))
  );

  const grants = await prisma.roleResourcePermission.findMany({
    include: { role: { select: { name: true, companyId: true } } },
  });
  console.log("=== GRANTS === total:", grants.length);
  for (const g of grants) {
    console.log(
      `${g.role.name}@${g.role.companyId ?? "GLOBAL"} :: ${g.resource} view=${g.viewScope}${g.viewCompanyIds.length ? JSON.stringify(g.viewCompanyIds) : ""} write=${g.writeScope}${g.writeCompanyIds.length ? JSON.stringify(g.writeCompanyIds) : ""}`
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
