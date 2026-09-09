import { notFound } from "next/navigation";
import { requireResource } from "@/backend/helpers/authz";
import { kpiAnalyticsService } from "@/backend/services/kpi-analytics.service";
import { RoleKpiSummaryClient } from "@/components/admin/kpi/role-kpi-summary-client";
import { PageShell, PageHeader, ErrorPanel } from "@/components/admin/page-shell";
import { IconChartHistogram } from "@tabler/icons-react";

/**
 * Ringkasan KPI · Jabatan — resource `kpi.analytics`, sama seperti Analisis
 * Kinerja: jabatan bisa dipakai lebih dari satu PT, jadi izinnya tidak
 * dipecah per PT.
 */
export default async function KpiRoleSummaryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; roleSlug: string }>;
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const { locale, roleSlug } = await params;
  await requireResource("kpi.analytics", "view", locale);

  const sp = await searchParams;
  const now = new Date();
  const month = Number(sp.month) || now.getMonth() + 1;
  const year = Number(sp.year) || now.getFullYear();

  let summary;
  try {
    summary = await kpiAnalyticsService.getRoleSummary(roleSlug, month, year);
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    return <ErrorPanel source="kpi/summary/[roleSlug]/page" message={msg} />;
  }

  if (!summary) notFound();

  return (
    <PageShell>
      <PageHeader
        title={`Ringkasan KPI · ${summary.roleName}`}
        description="Pencapaian tiap KPI jabatan ini per karyawan — bukan gabungan seluruh jabatan."
        eyebrow="KPI"
        icon={<IconChartHistogram className="size-5" />}
      />
      <RoleKpiSummaryClient summary={summary} />
    </PageShell>
  );
}
