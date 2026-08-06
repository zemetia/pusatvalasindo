import { IconArrowsExchange } from "@tabler/icons-react";

import { requireResource } from "@/backend/helpers/authz";
import { resolve } from "@/lib/authz/resolve";
import { getScopedCompaniesFor } from "@/backend/helpers/page-access";
import { buildValasTransactionPayload } from "@/backend/services/valas-transaction.service";
import { todayDateOnly } from "@/backend/helpers/date-only";
import { PageShell, PageHeader } from "@/components/admin/page-shell";
import { ValasTransactionPageClient } from "@/components/admin/valas/valas-transaction-page-client";

/**
 * Transaksi Jual & Beli Valas — pencatatan loket, per tanggal per PT.
 *
 * Kursnya berasal dari Harga Valas (BUY → harga beli, SELL → harga jual) dan
 * di-snapshot ke barisnya saat disimpan, jadi mengubah harga hari ini tidak
 * menggeser transaksi kemarin.
 */
export default async function TransaksiValasPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const authz = await requireResource("valas.transaction", "view", locale);

  const { companies, defaultCompanyId, canSelectCompany } = await getScopedCompaniesFor(authz);

  // Daftar PT, bukan boolean: hak mencatat bisa lebih sempit daripada hak lihat,
  // dan klien boleh berpindah PT. Pola yang sama dengan Dana Tertahan.
  const writeDecision = resolve(authz.subject, "valas.transaction", "write");
  const writableCompanyIds = writeDecision.allowed ? writeDecision.companyIds : [];

  // Membatalkan adalah kemampuan tersendiri — bisa dipegang jabatan yang justru
  // tidak boleh mencatat, dan sebaliknya.
  const voidDecision = resolve(authz.subject, "valas.transaction.void", "write");
  const voidCompanyIds = voidDecision.allowed ? voidDecision.companyIds : [];

  // Tanpa ini, transaksi bertanggal lampau ditolak server — jadi form harus
  // tahu supaya tanggalnya dikunci, bukan menyilakan mengisi lalu gagal.
  const backdateDecision = resolve(authz.subject, "daily.backdate", "write");
  const backdateCompanyIds = backdateDecision.allowed ? backdateDecision.companyIds : [];

  // Kalau PT-nya sudah pasti, transaksi hari ini ikut dirender di server supaya
  // klien tidak perlu fetch lagi setelah hydrate (DB-nya remote).
  let initialData = null;
  let initialKey: string | null = null;
  if (defaultCompanyId) {
    const today = todayDateOnly();
    try {
      const payload = await buildValasTransactionPayload(authz, defaultCompanyId, today);
      initialData = JSON.parse(JSON.stringify(payload));
      initialKey = `${defaultCompanyId}:${today.toISOString().slice(0, 10)}`;
    } catch {
      initialData = null;
      initialKey = null;
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Transaksi Valas"
        description="Pencatatan jual & beli valas di loket. Kurs mengikuti Harga Valas dan disimpan bersama transaksinya."
        icon={<IconArrowsExchange className="size-5" />}
      />
      <ValasTransactionPageClient
        companies={companies}
        defaultCompanyId={defaultCompanyId}
        writableCompanyIds={writableCompanyIds}
        voidCompanyIds={voidCompanyIds}
        backdateCompanyIds={backdateCompanyIds}
        canSelectCompany={canSelectCompany}
        initialData={initialData}
        initialKey={initialKey}
      />
    </PageShell>
  );
}
