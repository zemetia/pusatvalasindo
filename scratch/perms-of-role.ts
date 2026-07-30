import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const main = async () => {
  const roles = await prisma.custom_role.findMany({
    where: { name: { in: ["Kepala Cabang", "Teller Dalam", "Kepala Marketing"] }, companyId: { in: ["1", "2"] } },
    select: { name: true, companyId: true, permissions: true },
  });
  for (const r of roles) {
    console.log(`${r.name}@${r.companyId}: ${r.permissions.filter(p => p.startsWith("kpi") || p.startsWith("currency") || p.startsWith("bank")).join(", ")}`);
  }
  const acc = await prisma.bankAccount.findFirst({ where: { companyId: "1" }, select: { id: true } });
  console.log("bankAccountPVI:", acc?.id);
};
main().finally(() => prisma.$disconnect());
