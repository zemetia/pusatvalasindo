import { redirect } from "next/navigation";
import { getCaller } from "@/backend/helpers/get-admin-caller";
import { isGlobalRole } from "@/lib/permissions";
import { kpiAnalyticsService } from "@/backend/services/kpi-analytics.service";
import { PerformanceAnalysisClient } from "@/components/admin/kpi/performance-analysis-client";
import { PageShell, PageHeader, ErrorPanel } from "@/components/admin/page-shell";
import { IconChartHistogram } from "@tabler/icons-react";

/**
 * Analisis Kinerja — khusus Owner & Super Admin.
 *
 * Gerbangnya memakai `isGlobalRole`, bukan permission KPI, dengan sengaja:
 * halaman ini memeringkat karyawan lintas PT dan membandingkan cabang satu
 * sama lain, jadi tidak boleh ikut terbuka oleh peran yang terikat satu PT
 * meski peran itu punya `kpi.view_all` di PT-nya sendiri.
 */
export default async function KpiAnalysisPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const { locale } = await params;
  const caller = await getCaller();
  if (!caller) redirect(`/${locale}/login`);
  if (!isGlobalRole(caller.roleName)) redirect(`/${locale}/dashboard`);

  const sp = await searchParams;
  const now = new Date();
  const month = Number(sp.month) || now.getMonth() + 1;
  const year = Number(sp.year) || now.getFullYear();

  let overview;
  try {
    overview = await kpiAnalyticsService.getPerformanceOverview(month, year);
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    return <ErrorPanel source="kpi/analisis/page" message={msg} />;
  }

  return (
    <PageShell>
      <PageHeader
        title="Analisis Kinerja"
        description="Peringkat, tren, dan titik lemah seluruh karyawan dalam satu periode — lintas PT dan cabang."
        eyebrow="KPI"
        icon={<IconChartHistogram className="size-5" />}
      />
      <PerformanceAnalysisClient overview={overview} />
    </PageShell>
  );
}
