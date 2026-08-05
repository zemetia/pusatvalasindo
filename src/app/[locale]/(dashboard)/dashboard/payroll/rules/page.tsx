import { IconScale } from "@tabler/icons-react";

import { requireResource } from "@/backend/helpers/authz";
import { listRulesForUi } from "@/backend/services/payroll-rule.service";
import {
  ErrorPanel,
  MetricBlock,
  MetricRow,
  PageHeader,
  PageShell,
} from "@/components/admin/page-shell";
import { PayrollRulesPageClient } from "@/components/admin/payroll/payroll-rules-page-client";

// Rule dibaca ulang tiap kunjungan: halaman ini juga berfungsi sebagai
// pemeriksa kesehatan (tanda tangan, validasi, env setup), dan versi cache
// akan menyembunyikan persis masalah yang harus dilihat.
export const dynamic = "force-dynamic";

export default async function PayrollRulesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const authz = await requireResource("payroll.rules", "view", locale);

  // Dua izin berbeda bertemu di halaman ini. `payroll.rules` membuka tier,
  // nominal, sasaran, dan masa berlaku; SQL butuh capability tersendiri.
  const canWrite = authz.can("payroll.rules", "write");
  const canEditSql = authz.can("payroll.rules.sql", "write");

  let set;
  try {
    set = await listRulesForUi();
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    return <ErrorPanel source="payroll/rules/page" message={msg} />;
  }

  // Rule tidak lagi punya tipe: satu rule bisa menambah DAN mengurangi lewat
  // kondisi yang berbeda. Yang dihitung karena itu rule yang PUNYA sisi itu,
  // dan sebuah rule wajar muncul di kedua angka.
  const aktif = set.rules.filter((r) => r.aktif);
  const reward = aktif.filter((r) => r.tiers.some((t) => (t.nominal ?? 0) > 0)).length;
  const sanksi = aktif.filter((r) => r.tiers.some((t) => (t.nominal ?? 0) < 0)).length;
  const bermasalah = set.rules.filter((r) => r.errors.length > 0).length + set.broken.length;

  return (
    <PageShell>
      <PageHeader
        title="Rule Reward & Denda"
        eyebrow="Payroll"
        description={
          <>
            Aturan yang menentukan bonus, denda, dan potongan di slip gaji. Menyimpan
            perubahan selalu membuat <strong>versi baru</strong> — versi lama tidak
            pernah ditimpa, supaya slip yang sudah dibayar tetap bisa menjelaskan
            angkanya. Query-nya hanya boleh membaca view <code>hv_*</code> lewat koneksi
            read-only, dan hanya bisa diubah pemegang izin khusus.
          </>
        }
        icon={<IconScale className="size-5" />}
      />

      <MetricRow columns={4}>
        <MetricBlock
          label="Rule Berlaku"
          value={aktif.length}
          size="hero"
          meta={`dari ${set.rules.length} versi rule tersimpan`}
        />
        <MetricBlock label="Reward" value={reward} tone="success" meta="menambah gaji" />
        <MetricBlock
          label="Denda & Potongan"
          value={sanksi}
          tone="warning"
          meta="mengurangi gaji"
        />
        <MetricBlock
          label="Bermasalah"
          value={bermasalah}
          tone={bermasalah > 0 ? "destructive" : "muted"}
          meta={bermasalah > 0 ? "tidak ikut dihitung" : "semua lolos validasi"}
        />
      </MetricRow>

      <PayrollRulesPageClient set={set} canWrite={canWrite} canEditSql={canEditSql} />
    </PageShell>
  );
}
