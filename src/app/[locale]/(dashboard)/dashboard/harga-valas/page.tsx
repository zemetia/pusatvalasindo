import { requireResource } from "@/backend/helpers/authz";
import { currencyPriceService } from "@/backend/services/currency-price.service";
import { currencyPriceSyncService } from "@/backend/services/currency-price-sync.service";
import { HargaValasPageClient } from "@/components/admin/harga-valas-page-client";
import { ErrorPanel } from "@/components/admin/page-shell";

export default async function HargaValasPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const authz = await requireResource("currency.price", "view", locale);

  let rows;
  let setting;
  try {
    [rows, setting] = await Promise.all([
      currencyPriceService.getAll(),
      currencyPriceSyncService.getSetting(),
    ]);
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    return <ErrorPanel source="harga-valas/page" message={msg} />;
  }

  return (
    <HargaValasPageClient
      initialRows={rows}
      initialSetting={setting}
      canManage={authz.can("currency.price", "write")}
      // Tautan ke halaman lain hanya muncul kalau memang boleh dibuka —
      // percuma menawarkan pintu yang akan menolaknya.
      currencyPageHref={
        authz.can("currency", "view") ? `/${locale}/dashboard/mata-uang` : null
      }
      benchmarkPageHref={
        authz.can("price.benchmark", "view") ? `/${locale}/dashboard/patokan-harga` : null
      }
    />
  );
}
