import prisma from "@/lib/prisma";
import { UsersPageClient } from "@/components/admin/users-page-client";

export default async function UsersPage() {
  let result;
  try {
    result = await Promise.all([
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
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    return (
      <div className="flex min-h-[400px] items-center justify-center p-8">
        <pre className="max-w-2xl whitespace-pre-wrap break-all rounded bg-destructive/10 p-6 text-sm text-destructive font-mono border border-destructive/30">
          {`[users/page — fetch error]\n\n${msg}`}
        </pre>
      </div>
    )
  }
  const [users, branches, companies, roles] = result;

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
    positionAllowance: u.positionAllowance?.toString() ?? null,
    bpjsKesehatan: u.bpjsKesehatan?.toString() ?? null,
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
