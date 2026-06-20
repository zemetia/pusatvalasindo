import prisma from "@/lib/prisma";
import { StockItemsPageClient } from "@/components/admin/stock-items-page-client";

export default async function StockItemsPage() {
  const [items, branches, companies] = await Promise.all([
    prisma.stockItem.findMany({
      include: { branch: { select: { id: true, name: true } } },
      orderBy: [{ branch: { name: "asc" } }, { type: "asc" }, { sortOrder: "asc" }],
    }),
    prisma.branch.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, companyId: true },
    }),
    prisma.company.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <StockItemsPageClient
      items={items}
      branches={branches}
      companies={companies}
    />
  );
}
