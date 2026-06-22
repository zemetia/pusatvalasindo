import prisma from "@/lib/prisma";
import { StockManagementClient } from "@/components/admin/stock-management-client";
import { PageHeader } from "@/components/admin/page-header";
import { IconDatabase } from "@tabler/icons-react";

export default async function StockManagementPage() {
  let result;
  try {
    result = await Promise.all([
      prisma.company.findMany({
        orderBy: { name: "asc" },
        include: {
          branches: {
            where: { isActive: true },
            orderBy: { name: "asc" },
          },
        },
      }),
      prisma.branch.findMany({
        where: { isActive: true },
        include: {
          stockItems: {
            orderBy: [{ type: "asc" }, { sortOrder: "asc" }],
          },
          bankAccounts: {
            include: { currency: true },
            orderBy: { bankName: "asc" },
          },
        },
      }),
      prisma.currency.findMany({
        where: { isActive: true },
        orderBy: { code: "asc" },
      }),
    ]);
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    return (
      <div className="flex min-h-[400px] items-center justify-center p-8">
        <pre className="max-w-2xl whitespace-pre-wrap break-all rounded bg-destructive/10 p-6 text-sm text-destructive font-mono border border-destructive/30">
          {`[stock-management/page — fetch error]\n\n${msg}`}
        </pre>
      </div>
    )
  }
  const [companies, branches, currencies] = result;

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <PageHeader
        title="Stock Management"
        description="Kelola mata uang, aset, dan rekening bank di seluruh cabang."
        icon={<IconDatabase className="size-5" />}
      />

      <StockManagementClient
        companies={companies}
        branches={branches}
        currencies={currencies}
      />
    </div>
  );
}
