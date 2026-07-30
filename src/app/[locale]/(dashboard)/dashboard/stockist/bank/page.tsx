import { requireResource } from "@/backend/helpers/authz";
import { resolve } from "@/lib/authz/resolve";
import { getScopedCompaniesFor } from "@/backend/helpers/page-access";
import { BankPageClient } from "@/components/admin/stockist/bank-page-client";
import { PageShell, PageHeader } from "@/components/admin/page-shell";
import { IconBuildingBank } from "@tabler/icons-react";
import { buildBankHarianPayload } from "@/backend/services/bank-harian.service";
import { todayDateOnly } from "@/backend/helpers/date-only";

export default async function BankHarianPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const authz = await requireResource("bank.daily", "view", locale);

  // Saldo bank dimiliki 1 PT, dipakai bersama semua cabangnya. PT mana saja yang
  // boleh dilihat — dan mana yang boleh diubah — datang dari matriks izin, jadi
  // sebuah jabatan bisa memantau beberapa PT tapi hanya menginput di satu PT.
  const { companies, defaultCompanyId, canSelectCompany } = await getScopedCompaniesFor(authz);

  // Daftar PT yang boleh diinput — bukan satu boolean — karena hak input bisa
  // lebih sempit daripada hak lihat, dan klien boleh berpindah PT.
  const writeDecision = resolve(authz.subject, "bank.daily", "write");
  const writableCompanyIds = writeDecision.allowed ? writeDecision.companyIds : [];

  // PT yang boleh dikoreksi tanpa antre persetujuan. Daftar, bukan boolean:
  // izinnya bisa diberikan ke sebagian PT saja (mis. kepala cabang satu PT).
  const direct = resolve(authz.subject, "correction.direct", "write");
  const directCorrectionCompanyIds = direct.allowed ? direct.companyIds : [];

  // Sama seperti halaman Stock & Kas: kalau PT-nya sudah pasti, grid hari ini ikut dirender
  // di server supaya klien tidak perlu fetch lagi setelah hydrate. Global role belum pilih PT,
  // jadi tidak ada yang bisa di-prefetch.
  let initialGrid = null;
  let initialGridKey: string | null = null;
  if (defaultCompanyId) {
    const today = todayDateOnly();
    try {
      const payload = await buildBankHarianPayload(authz, defaultCompanyId, today);
      // Lewat JSON supaya bentuknya sama persis dengan respons NextResponse.json().
      initialGrid = JSON.parse(JSON.stringify(payload));
      initialGridKey = `${defaultCompanyId}:${today.toISOString().slice(0, 10)}`;
    } catch {
      initialGrid = null;
      initialGridKey = null;
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Saldo Bank Harian"
        description="Input & lihat saldo bank harian per PT."
        icon={<IconBuildingBank className="size-5" />}
      />
      <BankPageClient
        companies={companies}
        defaultCompanyId={defaultCompanyId}
        writableCompanyIds={writableCompanyIds}
        directCorrectionCompanyIds={directCorrectionCompanyIds}
        canSelectCompany={canSelectCompany}
        initialGrid={initialGrid}
        initialGridKey={initialGridKey}
      />
    </PageShell>
  );
}
