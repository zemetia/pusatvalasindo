import { PERMISSIONS } from "@/lib/permissions";
import { requirePageCaller, getScopedCompanies } from "@/backend/helpers/page-access";
import { StockistHistoryClient } from "@/components/admin/stockist/stockist-history-client";
import { PageShell, PageHeader } from "@/components/admin/page-shell";
import { IconHistory } from "@tabler/icons-react";

export default async function StockistHistoryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const caller = await requirePageCaller(PERMISSIONS.STOCKIST_VIEW, locale);

  // Global role (Super Admin/Owner) melihat semua PT & memilih bebas; role lain
  // di-scope ke PT sendiri. Non-global tanpa cabang tidak melihat PT mana pun.
  const { companies, effectiveCompanyId } = await getScopedCompanies(caller);

  return (
    <PageShell>
      <PageHeader
        title="Riwayat Stockist"
        description="Riwayat mutasi & koreksi saldo mata uang per pocket."
        icon={<IconHistory className="size-5" />}
      />
      <StockistHistoryClient companies={companies} defaultCompanyId={effectiveCompanyId} />
    </PageShell>
  );
}
