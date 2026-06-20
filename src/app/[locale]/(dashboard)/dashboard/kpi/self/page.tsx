import { redirect } from "next/navigation";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/permissions";
import { KpiSelfFillClient } from "@/components/kpi-self-fill-client";

export default async function KpiSelfPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect(`/${locale}/login`);

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      customRole: { select: { id: true, name: true, permissions: true } },
    },
  });

  if (!user) redirect(`/${locale}/login`);

  const permissions = user.customRole?.permissions ?? [];

  // Redirect karyawan yang punya akses penuh KPI ke halaman log
  if (can(permissions, PERMISSIONS.KPI_VIEW_ALL)) {
    redirect(`/${locale}/dashboard/kpi/log`);
  }

  // Karyawan tanpa permission fill tidak bisa masuk halaman ini
  if (!can(permissions, PERMISSIONS.KPI_FILL_OWN)) {
    redirect(`/${locale}/dashboard`);
  }

  const customRoleId = user.customRole?.id;
  const roleKpisRaw = customRoleId
    ? await prisma.roleKpi.findMany({
        where: { customRoleId },
        select: {
          kpiId: true,
          definition: { select: { name: true, type: true } },
        },
      })
    : [];

  const roleKpis = roleKpisRaw.map((rk) => ({
    kpiId: rk.kpiId,
    name: rk.definition.name,
    type: rk.definition.type as string,
  }));

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <div>
        <h1 className="text-2xl font-semibold">KPI Saya</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Catat kejadian atau pelanggaran KPI yang terjadi pada diri Anda.
        </p>
      </div>
      <KpiSelfFillClient
        userId={user.id}
        userName={user.name}
        roleName={user.customRole?.name ?? "—"}
        roleKpis={roleKpis}
      />
    </div>
  );
}
