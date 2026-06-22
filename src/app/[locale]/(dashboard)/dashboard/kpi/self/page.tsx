import { redirect } from "next/navigation";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/permissions";
import { KpiSelfFillClient } from "@/components/kpi-self-fill-client";
import { PageHeader } from "@/components/admin/page-header";
import { IconPencil } from "@tabler/icons-react";

export default async function KpiSelfPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect(`/${locale}/login`);

  let user;
  try {
    user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        customRole: { select: { id: true, name: true, permissions: true } },
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    return (
      <div className="flex min-h-[400px] items-center justify-center p-8">
        <pre className="max-w-2xl whitespace-pre-wrap break-all rounded bg-destructive/10 p-6 text-sm text-destructive font-mono border border-destructive/30">
          {`[kpi/self/page — fetch error]\n\n${msg}`}
        </pre>
      </div>
    )
  }

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
  let roleKpisRaw;
  try {
    roleKpisRaw = customRoleId
      ? await prisma.roleKpi.findMany({
          where: { customRoleId },
          select: {
            kpiId: true,
            definition: { select: { name: true, type: true } },
          },
        })
      : [];
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    return (
      <div className="flex min-h-[400px] items-center justify-center p-8">
        <pre className="max-w-2xl whitespace-pre-wrap break-all rounded bg-destructive/10 p-6 text-sm text-destructive font-mono border border-destructive/30">
          {`[kpi/self/page — fetch error]\n\n${msg}`}
        </pre>
      </div>
    )
  }

  const roleKpis = roleKpisRaw.map((rk) => ({
    kpiId: rk.kpiId,
    name: rk.definition.name,
    type: rk.definition.type as string,
  }));

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <PageHeader
        title="KPI Saya"
        description="Catat kejadian atau pelanggaran KPI yang terjadi pada diri Anda."
        icon={<IconPencil className="size-5" />}
      />
      <KpiSelfFillClient
        userId={user.id}
        userName={user.name}
        roleName={user.customRole?.name ?? "—"}
        roleKpis={roleKpis}
      />
    </div>
  );
}
