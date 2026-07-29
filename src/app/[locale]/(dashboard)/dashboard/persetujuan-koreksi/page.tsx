import { can, PERMISSIONS } from "@/lib/permissions";
import { requirePageCaller, getScopedCompanies } from "@/backend/helpers/page-access";
import { CorrectionApprovalClient } from "@/components/admin/stockist/correction-approval-client";
import { PageShell, PageHeader } from "@/components/admin/page-shell";
import { IconGavel } from "@tabler/icons-react";

export default async function CorrectionApprovalPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const caller = await requirePageCaller(PERMISSIONS.CORRECTION_VIEW, locale);
  // Melihat daftar cukup correction.view; memutuskan (setujui/tolak) butuh
  // correction.approve, yang hanya dimiliki Owner & Super Admin.
  const canApprove = can(caller.permissions, PERMISSIONS.CORRECTION_APPROVE);

  const { companies, defaultCompanyId, canSelectCompany } = await getScopedCompanies(caller);

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
