import { redirect } from "next/navigation";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/permissions";
import { CompanyStockClient } from "@/components/admin/company-stock/company-stock-client";
import { PageHeader } from "@/components/admin/page-header";
import { IconDatabase } from "@tabler/icons-react";

export default async function CompanyStockManagementPage({
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
  if (!can(permissions, PERMISSIONS.COMPANY_STOCK_VIEW)) {
    redirect(`/${locale}/dashboard`);
  }
  const canManage = can(permissions, PERMISSIONS.COMPANY_STOCK_MANAGE);

  const companies = await prisma.company.findMany({
    where: {
      isActive: true,
      ...(user.companyId ? { id: user.companyId } : {}),
    },
    orderBy: { name: "asc" },
    include: {
      companyStockItems: {
        orderBy: [{ type: "asc" }, { sortOrder: "asc" }],
      },
    },
  });

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <PageHeader
        title="Stock Management (PT)"
        description="Kelola stok mata uang & logam mulia per PT — terpisah dari stok per cabang."
        icon={<IconDatabase className="size-5" />}
      />

      <CompanyStockClient companies={companies} canManage={canManage} />
    </div>
  );
}
