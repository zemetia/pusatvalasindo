import { requireResource } from "@/backend/helpers/authz";
import { currencyPriceService } from "@/backend/services/currency-price.service";
import { CurrenciesPageClient } from "@/components/admin/currencies-page-client";
import { ErrorPanel } from "@/components/admin/page-shell";

export default async function MataUangPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const authz = await requireResource("currency", "view", locale);

  // Satu query yang sama dengan halaman Harga Valas: master mata uang plus
  // harganya, jadi kolom harga di sini tidak butuh round-trip tambahan.
  let rows;
  try {
    rows = await currencyPriceService.getAll();
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    return <ErrorPanel source="mata-uang/page" message={msg} />;
  }

  return (
    <CurrenciesPageClient
      currencies={rows.map((r) => ({
        id: r.currencyId,
        code: r.code,
        name: r.name,
        symbol: r.symbol,
        isActive: r.isActive,
        buyPrice: r.buyPrice,
        sellPrice: r.sellPrice,
      }))}
      canManage={authz.can("currency", "write")}
      pricePageHref={
        authz.can("currency.price", "view") ? `/${locale}/dashboard/harga-valas` : null
      }
    />
  );
}
