import prisma from "@/lib/prisma";
import { CurrenciesPageClient } from "@/components/admin/currencies-page-client";

export default async function CurrenciesPage() {
  const currencies = await prisma.currency.findMany({
    orderBy: { code: "asc" },
    include: {
      _count: { select: { stocks: true, bankAccounts: true } },
    },
  });

  const serialized = currencies.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    symbol: c.symbol,
    isActive: c.isActive,
    _count: c._count,
  }));

  return <CurrenciesPageClient currencies={serialized} />;
}
