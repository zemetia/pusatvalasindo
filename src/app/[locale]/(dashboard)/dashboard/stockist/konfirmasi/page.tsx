import { PERMISSIONS } from "@/lib/permissions";
import { requirePageCaller, getScopedCompanies } from "@/backend/helpers/page-access";
import { StockistHeadConfirmationClient } from "@/components/admin/stockist/stockist-head-confirmation-client";
import { PageHeader } from "@/components/admin/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { IconClipboardCheck, IconBuildingOff } from "@tabler/icons-react";

export default async function StockistHeadConfirmationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const caller = await requirePageCaller(PERMISSIONS.STOCKIST_VERIFY, locale);

  // Cross-check dimiliki 1 PT, dipakai bersama semua cabangnya. Global role
  // (Super Admin/Owner) memilih PT bebas & boleh edit tanggal lampau; role lain
  // di-scope ke PT sendiri (diturunkan dari cabangnya).
  const { companies, defaultCompanyId, canSelectCompany, effectiveCompanyId } =
    await getScopedCompanies(caller);
  const canEditPastDate = canSelectCompany;

  // Role non-global wajib terikat ke sebuah PT (lewat cabang). Kalau tidak, akunnya
  // belum dikonfigurasi — tampilkan pesan jelas, bukan pemilih semua PT.
  const isUnassigned = !canSelectCompany && !effectiveCompanyId;

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <PageHeader
        title="Cross-Check Stock"
        description="Hitung ulang total stock, kas, & bank oleh kepala cabang, dibandingkan otomatis dengan total sistem."
        icon={<IconClipboardCheck className="size-5" />}
      />
      {isUnassigned ? (
        <Alert variant="destructive">
          <IconBuildingOff className="size-4" />
          <AlertTitle>Akun belum terhubung ke PT</AlertTitle>
          <AlertDescription>
            Akun Anda belum terhubung ke perusahaan (PT) atau cabang mana pun, sehingga
            cross-check tidak dapat ditampilkan. Hubungi admin untuk menetapkan cabang/PT Anda.
          </AlertDescription>
        </Alert>
      ) : (
        <StockistHeadConfirmationClient
          companies={companies}
          defaultCompanyId={defaultCompanyId}
          canEditPastDate={canEditPastDate}
          canSelectCompany={canSelectCompany}
        />
      )}
    </div>
  );
}
