import prisma from "@/lib/prisma";
import { CurrenciesPageClient } from "@/components/admin/currencies-page-client";

export default async function CurrenciesPage() {
  let currencies;
  try {
    currencies = await prisma.currency.findMany({
      orderBy: { code: "asc" },
      include: {
        _count: { select: { stocks: true, bankAccounts: true } },
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    return (
      <div className="flex min-h-[400px] items-center justify-center p-8">
        <pre className="max-w-2xl whitespace-pre-wrap break-all rounded bg-destructive/10 p-6 text-sm text-destructive font-mono border border-destructive/30">
          {`[currencies/page — fetch error]\n\n${msg}`}
        </pre>
      </div>
    )
  }

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
