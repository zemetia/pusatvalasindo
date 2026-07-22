import { can, PERMISSIONS } from "@/lib/permissions";
import { requirePageCaller, getScopedCompanies } from "@/backend/helpers/page-access";
import { BankPageClient } from "@/components/admin/stockist/bank-page-client";
import { PageHeader } from "@/components/admin/page-header";
import { IconBuildingBank } from "@tabler/icons-react";

export default async function BankHarianPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const caller = await requirePageCaller(PERMISSIONS.BANK_VIEW, locale);
  const canManage = can(caller.permissions, PERMISSIONS.BANK_DAILY_INPUT);

  // Saldo bank dimiliki 1 PT, dipakai bersama semua cabangnya. Global role
  // (Super Admin/Owner) boleh memilih PT lain; role lain di-scope ke PT sendiri.
  const { companies, defaultCompanyId, canSelectCompany } = await getScopedCompanies(caller);

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <PageHeader
        title="Saldo Bank Harian"
        description="Input & lihat saldo bank harian per PT."
        icon={<IconBuildingBank className="size-5" />}
      />
      <BankPageClient
        companies={companies}
        defaultCompanyId={defaultCompanyId}
        canManage={canManage}
        canSelectCompany={canSelectCompany}
      />
    </div>
  );
}
