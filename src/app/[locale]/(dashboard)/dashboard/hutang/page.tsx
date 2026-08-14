import { IconClockDollar } from "@tabler/icons-react";

import { requireResource } from "@/backend/helpers/authz";
import { resolve } from "@/lib/authz/resolve";
import { getScopedCompaniesFor } from "@/backend/helpers/page-access";
import { buildHeldFundPayload } from "@/backend/services/held-fund.service";
import { todayDateOnly } from "@/backend/helpers/date-only";
import { PageShell, PageHeader } from "@/components/admin/page-shell";
import { HeldFundPageClient } from "@/components/admin/finance/held-fund-page-client";

/**
 * Dana Tertahan (Hutang) — uang yang belum berpindah, dicatat per tanggal,
 * dengan arah eksplisit: Credit (piutang) dan Debit (hutang perusahaan).
 *
 * Berbeda dari halaman input harian lain: tiap tanggal dimulai kosong dan
 * barisnya ditambah sebanyak yang memang terjadi. Statusnya bertahan melintasi
 * tanggal — karena itu tampilan bawaannya adalah daftar SELURUH yang belum
 * lunas, bukan isi satu tanggal. Tanggal lampau dibuka untuk *melunasi*, bukan
 * untuk mengoreksi angka — lihat pembagian izinnya di `held-fund-guard.ts`.
 */
export default async function HutangPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const authz = await requireResource("finance.receivable", "view", locale);

  const { companies, defaultCompanyId, canSelectCompany } = await getScopedCompaniesFor(authz);

  // Daftar PT, bukan boolean: hak input bisa lebih sempit daripada hak lihat, dan
  // klien boleh berpindah PT. Pola yang sama dengan Saldo Bank Harian.
  const writeDecision = resolve(authz.subject, "finance.receivable", "write");
  const writableCompanyIds = writeDecision.allowed ? writeDecision.companyIds : [];

  // Hak menyatakan lunas dipegang izin tersendiri — bisa diberikan ke jabatan yang
  // sama sekali tidak boleh menambah/mengubah isinya.
  const settleDecision = resolve(authz.subject, "finance.receivable.settle", "write");
  const settleCompanyIds = settleDecision.allowed ? settleDecision.companyIds : [];

  // Tanpa ini, mengubah baris tanggal lampau ditolak server — jadi grid harus
  // tahu supaya inputnya dikunci, bukan menyilakan mengetik lalu gagal.
  const backdateDecision = resolve(authz.subject, "daily.backdate", "write");
  const backdateCompanyIds = backdateDecision.allowed ? backdateDecision.companyIds : [];

  // Kalau PT-nya sudah pasti, baris hari ini ikut dirender di server supaya klien
  // tidak perlu fetch lagi setelah hydrate (DB-nya remote — satu round-trip penuh).
  let initialData = null;
  let initialKey: string | null = null;
  if (defaultCompanyId) {
    const today = todayDateOnly();
    try {
      const payload = await buildHeldFundPayload(authz, defaultCompanyId, today);
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
        title="Dana Tertahan"
        description="Hutang yang belum selesai di kedua arah — Credit (piutang, uang akan masuk) dan Debit (hutang perusahaan, uang akan keluar). Daftarnya lintas tanggal; tandai Lunas begitu uangnya berpindah."
        icon={<IconClockDollar className="size-5" />}
      />
      <HeldFundPageClient
        companies={companies}
        defaultCompanyId={defaultCompanyId}
        writableCompanyIds={writableCompanyIds}
        settleCompanyIds={settleCompanyIds}
        backdateCompanyIds={backdateCompanyIds}
        canSelectCompany={canSelectCompany}
        initialData={initialData}
        initialKey={initialKey}
      />
    </PageShell>
  );
}
