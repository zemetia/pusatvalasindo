import prisma from "../../src/lib/prisma";

async function main() {
  const roles = await prisma.custom_role.findMany({
    select: { id: true, name: true, companyId: true },
    orderBy: { name: "asc" },
  });
  console.log("Roles:", roles.map((r) => `${r.name} (${r.id})`).join("\n"));

  // Assign "Teller Dalam" role to kasir test user
  const tellerDalam = roles.find((r) => r.name === "Teller Dalam");
  if (!tellerDalam) {
    console.log("Role Teller Dalam tidak ditemukan");
    return;
  }

  const updated = await prisma.user.update({
    where: { email: "kasir.cengkareng@zemetia.com" },
    data: { customRoleId: tellerDalam.id },
    select: { name: true, customRole: { select: { name: true } } },
  });
  console.log(`\nAssigned: ${updated.name} → ${updated.customRole?.name}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
