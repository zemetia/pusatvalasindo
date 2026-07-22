import prisma from "@/lib/prisma";
import { RolesPageClient } from "@/components/admin/roles-page-client";
import { PageHeader } from "@/components/admin/page-header";
import { IconShieldLock } from "@tabler/icons-react";
import { getCaller } from "@/backend/helpers/get-admin-caller";
import { can, isGlobalRole, PERMISSIONS } from "@/lib/permissions";
import { redirect } from "next/navigation";

export default async function RolesPage() {
  const caller = await getCaller();
  if (!caller || !can(caller.permissions, PERMISSIONS.ROLES_VIEW)) {
    redirect("/dashboard");
  }

  // Global role (Super Admin/Owner) melihat role semua PT; role lain di-scope ke PT-nya.
  const scopedCompanyId = isGlobalRole(caller.roleName) ? undefined : caller.companyId;

  let result;
  try {
    result = await Promise.all([
      prisma.custom_role.findMany({
        where: scopedCompanyId !== undefined ? { companyId: scopedCompanyId } : undefined,
        orderBy: { name: "asc" },
        include: {
          _count: { select: { users: true } },
        },
      }),
      prisma.company.findMany({
        where: scopedCompanyId ? { id: scopedCompanyId } : undefined,
        orderBy: { name: "asc" },
      }),
    ]);
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    return (
      <div className="flex min-h-[400px] items-center justify-center p-8">
        <pre className="max-w-2xl whitespace-pre-wrap break-all rounded bg-destructive/10 p-6 text-sm text-destructive font-mono border border-destructive/30">
          {`[roles/page — fetch error]\n\n${msg}`}
        </pre>
      </div>
    )
  }
  const [roles, companies] = result;

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <PageHeader
        title="Manajemen Role"
        description="Kelola hak akses dan tanggung jawab personel berdasarkan perusahaan."
        icon={<IconShieldLock className="size-5" />}
      />

      <RolesPageClient
        companies={companies}
        roles={roles.map((r) => ({
          ...r,
          companyId: r.companyId ?? null,
        }))}
      />
    </div>
  );
}
