import { requireResource } from "@/backend/helpers/authz";
import { getScopedCompaniesFor } from "@/backend/helpers/page-access";
import { CorrectionApprovalClient } from "@/components/admin/stockist/correction-approval-client";
import { PageShell, PageHeader } from "@/components/admin/page-shell";
import { IconGavel } from "@tabler/icons-react";

export default async function CorrectionApprovalPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // Resource global: keputusan koreksi mengubah saldo, jadi wewenangnya tidak
  // dipecah per PT. Melihat daftar dan memutuskan tetap izin terpisah.
  const authz = await requireResource("correction", "view", locale);
  const canApprove = authz.can("correction", "write");

  const { companies, defaultCompanyId, canSelectCompany } = await getScopedCompaniesFor(authz);

  return (
    <PageShell>
      <PageHeader
        title="Persetujuan Koreksi"
        description="Pengajuan penggantian angka stock, kas, & bank harian dari hasil konfirmasi H+1 — berlaku setelah disetujui Owner / Super Admin."
        icon={<IconGavel className="size-5" />}
      />
      <CorrectionApprovalClient
        companies={companies}
        defaultCompanyId={defaultCompanyId}
        canSelectCompany={canSelectCompany}
        canApprove={canApprove}
      />
    </PageShell>
  );
}
