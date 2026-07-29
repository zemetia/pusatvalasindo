import { redirect } from "next/navigation";
import { getCaller } from "@/backend/helpers/get-admin-caller";
import { can, PERMISSIONS } from "@/lib/permissions";
import { kpiService, resolveInputPolicy } from "@/backend/services/kpi.service";
import { KpiSelfFillClient } from "@/components/kpi-self-fill-client";
import { PageShell, PageHeader, ErrorPanel } from "@/components/admin/page-shell";
import { IconPencil } from "@tabler/icons-react";

export default async function KpiSelfPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const caller = await getCaller();
  if (!caller) redirect(`/${locale}/login`);

  if (!can(caller.permissions, PERMISSIONS.KPI_FILL_OWN)) {
    redirect(`/${locale}/dashboard`);
  }

  let data;
  try {
    data = await kpiService.getRoleKpisForEmployee(caller.id);
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    return <ErrorPanel source="kpi/self/page" message={msg} />;
  }

  // Halaman ini hanya menampilkan KPI yang memang boleh diisi sendiri. KPI
  // bersumber SUPERVISOR/SYSTEM tetap dinilai, tapi tidak lewat sini — itulah
  // pemisah antara "boleh diisi sendiri" dan "tidak".
  const fillable = data.roleKpis
    .filter((rk) => resolveInputPolicy(rk).inputSource === "SELF")
    .map((rk) => {
      const policy = resolveInputPolicy(rk);
      return {
        roleKpiId: rk.id,
        name: rk.definition.name,
        description: rk.definition.description,
        scoringType: rk.definition.scoringType as string,
        unit: rk.definition.unit as string,
        requiresApproval: policy.requiresApproval,
        requiresEvidence: policy.requiresEvidence,
        targetValue: rk.targetValue?.toString() ?? null,
        pointPerUnit: rk.pointPerUnit?.toString() ?? null,
        toleranceLimit: rk.toleranceLimit?.toString() ?? null,
      };
    });

  const supervisorOnlyCount = data.roleKpis.length - fillable.length;

  return (
    <PageShell>
      <PageHeader
        title="Input KPI Saya"
        description="Catat sendiri capaian dan kejadian KPI Anda per tanggal. Sebagian butuh persetujuan atasan sebelum dihitung."
        icon={<IconPencil className="size-5" />}
      />
      <KpiSelfFillClient
        userId={caller.id}
        userName={data.employee.name}
        roleName={data.employee.roleName}
        companyName={data.employee.companyName}
        fillableKpis={fillable}
        supervisorOnlyCount={supervisorOnlyCount}
      />
    </PageShell>
  );
}
