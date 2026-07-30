import { requireResource } from "@/backend/helpers/authz";
import { kpiAnalyticsService } from "@/backend/services/kpi-analytics.service";
import { PerformanceAnalysisClient } from "@/components/admin/kpi/performance-analysis-client";
import { PageShell, PageHeader, ErrorPanel } from "@/components/admin/page-shell";
import { IconChartHistogram } from "@tabler/icons-react";

/**
 * Analisis Kinerja — resource `kpi.analytics`, scoping global.
 *
 * Halaman ini memeringkat karyawan lintas PT dan membandingkan cabang satu
 * sama lain, jadi izinnya tidak dipecah per PT: yang ada hanya "boleh membuka"
 * atau tidak. Default-nya tetap Owner & Super Admin (tanpa peta legacy), tapi
 * kini bisa didelegasikan eksplisit lewat matriks izin di halaman Jabatan.
 */
export default async function KpiAnalysisPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const { locale } = await params;
  await requireResource("kpi.analytics", "view", locale);

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
