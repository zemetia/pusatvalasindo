import prisma from "@/lib/prisma";
import { ErrorPanel } from "@/components/admin/page-shell";
import { UsersPageClient } from "@/components/admin/users-page-client";
import { getCaller } from "@/backend/helpers/get-admin-caller";
import { can, isAdminRole, isGlobalRole, PERMISSIONS } from "@/lib/permissions";
import { redirect } from "next/navigation";

export default async function UsersPage() {
  // Hanya Super Admin, Owner, dan Kepala Cabang yang boleh membuka halaman ini —
  // role lain (HR, Akuntan, Kasir, dst.) diarahkan kembali ke dashboard.
  const caller = await getCaller();
  if (!caller || !isAdminRole(caller.roleName)) {
    redirect("/dashboard");
  }

  // Super Admin / Owner melihat semua PT; Kepala Cabang dikunci ke PT-nya
  // sendiri (companyId diturunkan dari cabang, lihat getCallerRecord).
  const global = isGlobalRole(caller.roleName);
  // Kepala Cabang tanpa PT (tidak punya cabang) tidak bisa di-scope dengan aman.
  if (!global && !caller.companyId) {
    redirect("/dashboard");
  }
  // companyId is guaranteed non-null here for scoped callers (redirected above).
  const scopedCompanyId: string | undefined = global ? undefined : caller.companyId ?? undefined;

  let result;
  try {
    result = await Promise.all([
      prisma.user.findMany({
        where: scopedCompanyId !== undefined ? { branch: { companyId: scopedCompanyId } } : undefined,
        include: {
          branch: { select: { id: true, name: true, company: { select: { code: true } } } },
          customRole: { select: { id: true, name: true } },
        },
        orderBy: [{ branch: { name: "asc" } }, { name: "asc" }],
      }),
      prisma.branch.findMany({
        where: { isActive: true, ...(scopedCompanyId !== undefined ? { companyId: scopedCompanyId } : {}) },
        orderBy: { name: "asc" },
        select: { id: true, name: true, companyId: true },
      }),
      prisma.company.findMany({
        where: { isActive: true, ...(scopedCompanyId !== undefined ? { id: scopedCompanyId } : {}) },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.custom_role.findMany({
        // Kepala Cabang hanya boleh menetapkan role milik PT-nya (tidak ada
        // role global seperti Super Admin/Owner yang companyId-nya null).
        where: scopedCompanyId !== undefined ? { companyId: scopedCompanyId } : undefined,
        orderBy: { name: "asc" },
        select: { id: true, name: true, companyId: true },
      }),
    ]);
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    return (
      <ErrorPanel source="users/page" message={msg} />
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

  // Nama karyawan baru jadi tautan bila caller memang boleh membuka detailnya —
  // gerbangnya sama persis dengan yang dijaga halaman detail.
  const canOpenDetail =
    isGlobalRole(caller.roleName) || can(caller.permissions, PERMISSIONS.USERS_VIEW_DETAIL);

  return (
    <UsersPageClient
      users={serialized}
      branches={branches}
      companies={companies}
      roles={roles}
      canOpenDetail={canOpenDetail}
    />
  );
}
