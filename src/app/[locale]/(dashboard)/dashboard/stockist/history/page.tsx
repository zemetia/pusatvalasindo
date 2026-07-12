import { redirect } from "next/navigation";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/permissions";
import { StockistHistoryClient } from "@/components/admin/stockist/stockist-history-client";
import { PageHeader } from "@/components/admin/page-header";
import { IconHistory } from "@tabler/icons-react";

export default async function StockistHistoryPage({
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
      companyId: true,
      customRole: { select: { permissions: true } },
    },
  });
  if (!user) redirect(`/${locale}/login`);

  const permissions = user.customRole?.permissions ?? [];
  if (!can(permissions, PERMISSIONS.STOCKIST_VIEW)) {
    redirect(`/${locale}/dashboard`);
  }

  const companies = await prisma.company.findMany({
    where: {
      isActive: true,
      ...(user.companyId ? { id: user.companyId } : {}),
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <PageHeader
        title="Riwayat Stockist"
        description="Riwayat mutasi & koreksi saldo mata uang per pocket."
        icon={<IconHistory className="size-5" />}
      />
      <StockistHistoryClient companies={companies} defaultCompanyId={user.companyId} />
    </div>
  );
}
