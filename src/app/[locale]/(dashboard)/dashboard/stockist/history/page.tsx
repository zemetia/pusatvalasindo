import { requireResource } from "@/backend/helpers/authz";
import { getScopedCompaniesFor } from "@/backend/helpers/page-access";
import { StockistHistoryClient } from "@/components/admin/stockist/stockist-history-client";
import { PageShell, PageHeader } from "@/components/admin/page-shell";
import { IconHistory } from "@tabler/icons-react";

export default async function StockistHistoryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // Resource yang sama dengan halaman Stock & Kas Harian dan /api/stockist/history,
  // jadi riwayat tidak bisa lebih longgar dari data yang jadi sumbernya.
  const authz = await requireResource("stockist.daily", "view", locale);

  // Daftar PT mengikuti scope baca-nya: bisa satu PT, beberapa PT, atau semua —
  // bukan lagi "global atau PT sendiri".
  const { companies, defaultCompanyId } = await getScopedCompaniesFor(authz);

  return (
    <PageShell>
      <PageHeader
        title="Riwayat Stockist"
        description="Riwayat mutasi & koreksi saldo mata uang per pocket."
        icon={<IconHistory className="size-5" />}
      />
      <StockistHistoryClient companies={companies} defaultCompanyId={defaultCompanyId} />
    </PageShell>
  );
}
