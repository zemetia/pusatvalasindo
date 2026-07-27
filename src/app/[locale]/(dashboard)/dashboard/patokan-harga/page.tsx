import { can, PERMISSIONS } from "@/lib/permissions";
import { requirePageCaller } from "@/backend/helpers/page-access";
import { priceBenchmarkService } from "@/backend/services/price-benchmark.service";
import { PatokanHargaPageClient } from "@/components/admin/patokan-harga-page-client";

export default async function PatokanHargaPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const caller = await requirePageCaller(PERMISSIONS.CURRENCY_VIEW, locale);

  const rows = await priceBenchmarkService.getAll();
  const canManage = can(caller.permissions, PERMISSIONS.CURRENCY_MANAGE);

  return <PatokanHargaPageClient initialRows={rows} canManage={canManage} />;
}
