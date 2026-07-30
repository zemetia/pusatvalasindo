import prisma from "@/lib/prisma";
import { RolesPageClient } from "@/components/admin/roles-page-client";
import { PageShell, PageHeader, ErrorPanel } from "@/components/admin/page-shell";
import { IconShieldLock } from "@tabler/icons-react";
import { requireResource } from "@/backend/helpers/authz";
import { isGlobalRole } from "@/lib/permissions";

export default async function RolesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // Resource `roles` bersifat global (lihat lib/authz/resources.ts): matriks
  // izin adalah satu sistem yang sama untuk seluruh PT, jadi tidak ada dimensi
  // PT di sini — yang ada hanya punya akses atau tidak.
  const authz = await requireResource("roles", "view", locale);
  const canManage = authz.can("roles", "write");

  let result;
  try {
    result = await Promise.all([
      prisma.custom_role.findMany({
        orderBy: { name: "asc" },
        include: {
          _count: { select: { users: true } },
        },
      }),
      prisma.company.findMany({
        orderBy: { name: "asc" },
      }),
    ]);
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    return (
      <ErrorPanel source="roles/page" message={msg} />
    )
  }
  const [roles, companies] = result;

  return (
    <PageShell>
      <PageHeader
        title="Manajemen Role"
        description="Kelola hak akses dan tanggung jawab personel berdasarkan perusahaan."
        icon={<IconShieldLock className="size-5" />}
      />

      <RolesPageClient
        canManage={canManage}
        // Mode "Semua PT" di matriks izin tetap dikunci ke Super Admin & Owner,
        // terpisah dari wewenang mengelola jabatan. Pengelola jabatan yang
        // didelegasikan boleh mengatur izin, tapi tidak boleh memberikan
        // wewenang yang lebih luas daripada PT-nya sendiri — batas yang sama
        // ditegakkan ulang di PUT /api/roles/[id]/permissions.
        canGrantAll={isGlobalRole(authz.roleName)}
        companies={companies}
        roles={roles.map((r) => ({
          ...r,
          companyId: r.companyId ?? null,
        }))}
      />
    </PageShell>
  );
}
