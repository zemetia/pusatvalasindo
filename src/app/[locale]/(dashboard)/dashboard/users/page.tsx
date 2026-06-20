import prisma from "@/lib/prisma";
import { UsersPageClient } from "@/components/admin/users-page-client";

export default async function UsersPage() {
  const [users, branches, companies, roles] = await Promise.all([
    prisma.user.findMany({
      include: {
        branch: { select: { id: true, name: true } },
        customRole: { select: { id: true, name: true } },
      },
      orderBy: [{ branch: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.branch.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, companyId: true },
    }),
    prisma.company.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.custom_role.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, companyId: true },
    }),
  ]);

  const serialized = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    emailVerified: u.emailVerified,
    phone: u.phone,
    roleId: u.customRoleId,
    roleName: u.customRole?.name || null,
    branchId: u.branchId,
    baseSalary: u.baseSalary?.toString() ?? null,
    mealAllowance: u.mealAllowance?.toString() ?? null,
    transportAllowance: u.transportAllowance?.toString() ?? null,
    joinDate: u.joinDate?.toISOString() ?? null,
    isActive: u.isActive,
    createdAt: u.createdAt.toISOString(),
    branch: u.branch,
  }));

  return (
    <UsersPageClient
      users={serialized}
      branches={branches}
      companies={companies}
      roles={roles}
    />
  );
}
