import { can, PERMISSIONS } from "@/lib/permissions";
import { requirePageCaller, getScopedCompanies } from "@/backend/helpers/page-access";
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
  const caller = await requirePageCaller(PERMISSIONS.STOCKIST_VIEW, locale);
  const canManage = can(caller.permissions, PERMISSIONS.STOCKIST_MANAGE);

  // Stockist & Kas dimiliki 1 PT, dipakai bersama semua cabangnya. Global role
  // (Super Admin/Owner) boleh memilih PT lain; role lain di-scope ke PT sendiri.
  const { companies, defaultCompanyId, canSelectCompany } = await getScopedCompanies(caller);

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
      const payload = await buildStockistGridPayload(caller, defaultCompanyId, today);
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
        canManage={canManage}
        canSelectCompany={canSelectCompany}
        initialGrid={initialGrid}
        initialGridKey={initialGridKey}
      />
    </PageShell>
  );
}
