import { can, PERMISSIONS } from "@/lib/permissions";
import { requirePageCaller, getScopedCompanies } from "@/backend/helpers/page-access";
import Link from "next/link";
import { StockistTabs } from "@/components/admin/stockist/stockist-tabs";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { IconHistory, IconWallet } from "@tabler/icons-react";

export default async function StockistPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const caller = await requirePageCaller(PERMISSIONS.STOCKIST_VIEW, locale);
  const canManage = can(caller.permissions, PERMISSIONS.STOCKIST_MANAGE);

  // Stockist & Kas dimiliki 1 PT, dipakai bersama semua cabangnya. Global role
  // (Super Admin/Owner) boleh memilih PT lain; role lain di-scope ke PT sendiri.
  const { companies, defaultCompanyId, canSelectCompany } = await getScopedCompanies(caller);

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <PageHeader
        title="Stock & Kas"
        description="Stock mata uang & kas tunai per PT."
        icon={<IconWallet className="size-5" />}
        action={
          <Button variant="outline" size="sm" asChild>
            <Link href={`/${locale}/dashboard/stockist/history`}>
              <IconHistory className="size-4" />
              Riwayat
            </Link>
          </Button>
        }
      />
      <StockistTabs
        companies={companies}
        defaultCompanyId={defaultCompanyId}
        canManage={canManage}
        canSelectCompany={canSelectCompany}
      />
    </div>
  );
}
