import prisma from "@/lib/prisma";
import { StockItemsPageClient } from "@/components/admin/stock-items-page-client";

export default async function StockItemsPage() {
  let result;
  try {
    result = await Promise.all([
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
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    return (
      <div className="flex min-h-[400px] items-center justify-center p-8">
        <pre className="max-w-2xl whitespace-pre-wrap break-all rounded bg-destructive/10 p-6 text-sm text-destructive font-mono border border-destructive/30">
          {`[stock-items/page — fetch error]\n\n${msg}`}
        </pre>
      </div>
    )
  }
  const [items, branches, companies] = result;

  return (
    <StockItemsPageClient
      items={items}
      branches={branches}
      companies={companies}
    />
  );
}
