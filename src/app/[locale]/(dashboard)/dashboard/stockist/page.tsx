import { requireResource } from "@/backend/helpers/authz";
import { resolve } from "@/lib/authz/resolve";
import { getScopedCompaniesFor } from "@/backend/helpers/page-access";
import { buildStockistGridPayload } from "@/backend/services/stockist.service";
import { todayDateOnly } from "@/backend/helpers/date-only";
import Link from "next/link";
import { StockistTabs } from "@/components/admin/stockist/stockist-tabs";
import { PageShell, PageHeader } from "@/components/admin/page-shell";
import { Button } from "@/components/ui/button";
import { IconHistory, IconWallet } from "@tabler/icons-react";

export default async function StockistPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const authz = await requireResource("stockist.daily", "view", locale);

  // Stockist & Kas dimiliki 1 PT, dipakai bersama semua cabangnya. PT yang boleh
  // dilihat — dan mana yang boleh diisi — datang dari matriks izin, jadi sebuah
  // jabatan bisa memantau beberapa PT tapi hanya menginput di sebagian.
  const { companies, defaultCompanyId, canSelectCompany } = await getScopedCompaniesFor(authz);

  const write = resolve(authz.subject, "stockist.daily", "write");
  const writableCompanyIds = write.allowed ? write.companyIds : [];

  // PT yang boleh dikoreksi tanpa antre persetujuan. Daftar, bukan boolean:
  // izinnya bisa diberikan ke sebagian PT saja (mis. kepala cabang satu PT).
  const direct = resolve(authz.subject, "correction.direct", "write");
  const directCorrectionCompanyIds = direct.allowed ? direct.companyIds : [];

  // Kalau PT-nya sudah pasti (role non-global), grid hari ini ikut dirender di server dan
  // dikirim bersama HTML. Tanpa ini klien baru mulai fetch SETELAH hydrate — satu perjalanan
  // browser → function → database penuh yang percuma. Global role belum pilih PT, jadi tidak
  // ada yang bisa di-prefetch.
  //
  // initialGridKey mengunci payload ke kombinasi PT + tanggal yang dipakai server. Klien
  // memakainya hanya kalau cocok; kalau user ganti tanggal/PT (atau tanggal browser beda
  // dengan tanggal server) klien fetch seperti biasa.
  let initialGrid = null;
  let initialGridKey: string | null = null;
  if (defaultCompanyId) {
    const today = todayDateOnly();
    try {
      const payload = await buildStockistGridPayload(authz, defaultCompanyId, today);
      // Lewat JSON supaya Decimal/Date jadi bentuk yang sama persis dengan respons
      // NextResponse.json() — sekaligus membuatnya bisa diserialisasi ke client component.
      initialGrid = JSON.parse(JSON.stringify(payload));
      initialGridKey = `${defaultCompanyId}:${today.toISOString().slice(0, 10)}`;
    } catch {
      // Prefetch murni optimasi — kalau gagal, klien tetap bisa memuat sendiri.
      initialGrid = null;
      initialGridKey = null;
    }
  }

  return (
    <PageShell>
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
        writableCompanyIds={writableCompanyIds}
        directCorrectionCompanyIds={directCorrectionCompanyIds}
        canSelectCompany={canSelectCompany}
        initialGrid={initialGrid}
        initialGridKey={initialGridKey}
      />
    </PageShell>
  );
}
