import prisma from "@/lib/prisma";
import { can, isGlobalRole, PERMISSIONS } from "@/lib/permissions";
import { requirePageCaller } from "@/backend/helpers/page-access";
import { CompanyStockClient } from "@/components/admin/company-stock/company-stock-client";
import { PageShell, PageHeader } from "@/components/admin/page-shell";
import { IconDatabase } from "@tabler/icons-react";

export default async function CompanyStockManagementPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const caller = await requirePageCaller(PERMISSIONS.COMPANY_STOCK_VIEW, locale);
  const canManage = can(caller.permissions, PERMISSIONS.COMPANY_STOCK_MANAGE);

  // Global role (Super Admin/Owner) melihat semua PT; role lain di-scope ke PT
  // sendiri. Non-global tanpa cabang tidak melihat PT mana pun. Query pakai
  // `include` (butuh companyStockItems), jadi tidak lewat getScopedCompanies.
  const canSelectCompany = isGlobalRole(caller.roleName);
  const companies = await prisma.company.findMany({
    where: {
      isActive: true,
      ...(canSelectCompany ? {} : { id: caller.companyId ?? "" }),
    },
    orderBy: { name: "asc" },
    include: {
      companyStockItems: {
        orderBy: [{ type: "asc" }, { sortOrder: "asc" }],
      },
    },
  });

  return (
    <PageShell>
      <PageHeader
        title="Stock Management (PT)"
        description="Kelola stok mata uang & logam mulia per PT — terpisah dari stok per cabang."
        icon={<IconDatabase className="size-5" />}
      />

      <CompanyStockClient companies={companies} canManage={canManage} />
    </PageShell>
  );
}
