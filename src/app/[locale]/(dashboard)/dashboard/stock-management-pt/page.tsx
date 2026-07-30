import prisma from "@/lib/prisma";
import { requireResource } from "@/backend/helpers/authz";
import { resolve } from "@/lib/authz/resolve";
import { CompanyStockClient } from "@/components/admin/company-stock/company-stock-client";
import { PageShell, PageHeader } from "@/components/admin/page-shell";
import { IconDatabase } from "@tabler/icons-react";

export default async function CompanyStockManagementPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const authz = await requireResource("stock.pt", "view", locale);

  // PT yang terlihat berasal dari scope izin. Query pakai `include` (butuh
  // companyStockItems), jadi tidak lewat getScopedCompaniesFor.
  const companies = await prisma.company.findMany({
    where: { isActive: true, ...authz.where("id") },
    orderBy: { name: "asc" },
    include: {
      companyStockItems: {
        orderBy: [{ type: "asc" }, { sortOrder: "asc" }],
      },
    },
  });

  // Daftar PT yang boleh diubah — bukan satu boolean — karena hak ubah bisa
  // lebih sempit daripada hak lihat, dan klien berpindah antar PT.
  const write = resolve(authz.subject, "stock.pt", "write");
  const writableCompanyIds = write.allowed ? write.companyIds : [];

  return (
    <PageShell>
      <PageHeader
        title="Stock Management (PT)"
        description="Kelola stok mata uang & logam mulia per PT — terpisah dari stok per cabang."
        icon={<IconDatabase className="size-5" />}
      />

      <CompanyStockClient companies={companies} writableCompanyIds={writableCompanyIds} />
    </PageShell>
  );
}
