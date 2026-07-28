import { can, PERMISSIONS } from "@/lib/permissions";
import { requirePageCaller, getScopedCompanies } from "@/backend/helpers/page-access";
import { BankPageClient } from "@/components/admin/stockist/bank-page-client";
import { PageHeader } from "@/components/admin/page-header";
import { IconBuildingBank } from "@tabler/icons-react";
import { buildBankHarianPayload } from "@/backend/services/bank-harian.service";
import { todayDateOnly } from "@/backend/helpers/date-only";

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

  // Sama seperti halaman Stock & Kas: kalau PT-nya sudah pasti, grid hari ini ikut dirender
  // di server supaya klien tidak perlu fetch lagi setelah hydrate. Global role belum pilih PT,
  // jadi tidak ada yang bisa di-prefetch.
  let initialGrid = null;
  let initialGridKey: string | null = null;
  if (defaultCompanyId) {
    const today = todayDateOnly();
    try {
      const payload = await buildBankHarianPayload(caller, defaultCompanyId, today);
      // Lewat JSON supaya bentuknya sama persis dengan respons NextResponse.json().
      initialGrid = JSON.parse(JSON.stringify(payload));
      initialGridKey = `${defaultCompanyId}:${today.toISOString().slice(0, 10)}`;
    } catch {
      initialGrid = null;
      initialGridKey = null;
    }
  }

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
        initialGrid={initialGrid}
        initialGridKey={initialGridKey}
      />
    </div>
  );
}
