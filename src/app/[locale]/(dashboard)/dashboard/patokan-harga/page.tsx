import { requireResource } from "@/backend/helpers/authz";
import { priceBenchmarkService } from "@/backend/services/price-benchmark.service";
import { PatokanHargaPageClient } from "@/components/admin/patokan-harga-page-client";

export default async function PatokanHargaPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // Resource global: patokan harga adalah acuan tunggal untuk seluruh PT,
  // jadi tidak ada penyaringan per PT di sini.
  const authz = await requireResource("price.benchmark", "view", locale);

  const rows = await priceBenchmarkService.getAll();
  const canManage = authz.can("price.benchmark", "write");

  return (
    <PatokanHargaPageClient
      initialRows={rows}
      canManage={canManage}
      // Tombol "Terapkan ke Harga Valas" digerbangi izin tulis halaman TUJUAN,
      // bukan halaman ini — di sanalah angkanya berubah.
      canPushToPrices={authz.can("currency.price", "write")}
    />
  );
}
