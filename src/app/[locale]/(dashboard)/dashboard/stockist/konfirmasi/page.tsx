import { requireResource } from "@/backend/helpers/authz";
import { resolve } from "@/lib/authz/resolve";
import { getScopedCompaniesFor } from "@/backend/helpers/page-access";
import { StockistHeadConfirmationClient } from "@/components/admin/stockist/stockist-head-confirmation-client";
import { PageShell, PageHeader } from "@/components/admin/page-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { IconClipboardCheck, IconBuildingOff } from "@tabler/icons-react";

export default async function StockistHeadConfirmationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const authz = await requireResource("stockist.verify", "view", locale);

  // Cross-check dimiliki 1 PT, dipakai bersama semua cabangnya. PT yang boleh
  // dilihat datang dari scope izin.
  const { companies, defaultCompanyId, canSelectCompany, effectiveCompanyId } =
    await getScopedCompaniesFor(authz);

  // Kemampuan tersendiri, di-scope per PT lewat matriks izin. Dulu menumpang
  // variabel "boleh memilih PT", yang tidak ada kaitannya sama sekali.
  const backdate = resolve(authz.subject, "daily.backdate", "write");
  const backdateCompanyIds = backdate.allowed ? backdate.companyIds : [];

  // Pemanggil yang tidak terjangkau PT mana pun berarti akunnya belum
  // dikonfigurasi — tampilkan pesan jelas, bukan pemilih kosong.
  const isUnassigned = companies.length === 0 && !effectiveCompanyId;

  return (
    <PageShell>
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
          backdateCompanyIds={backdateCompanyIds}
          canSelectCompany={canSelectCompany}
        />
      )}
    </PageShell>
  );
}
