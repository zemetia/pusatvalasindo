import prisma from "@/lib/prisma";
import {
  KpiPageClient,
  CompanyRow,
  RoleKpiSummaryRow,
} from "@/components/admin/kpi-page-client";
import { PageShell, PageHeader, ErrorPanel } from "@/components/admin/page-shell";
import { IconTargetArrow } from "@tabler/icons-react";

export default async function KpiPage() {
  let result;
  try {
    result = await Promise.all([
      prisma.company.findMany({ orderBy: { name: "asc" } }),
      prisma.roleKpi.findMany({
        where: { isActive: true },
        select: {
          companyId: true,
          customRoleId: true,
          weight: true,
        },
      }),
      prisma.custom_role.findMany({
        orderBy: { name: "asc" },
      }),
    ]);
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    return (
      <ErrorPanel source="kpi/page" message={msg} />
    )
  }
  const [companies, roleKpisRaw, customRoles] = result;

  const summaryMap: Record<string, RoleKpiSummaryRow> = {};
  for (const rk of roleKpisRaw) {
    if (!rk.customRoleId) continue; // Skip legacy or invalid entries
    
    const key = `${rk.companyId}__custom__${rk.customRoleId}`;
    
    if (!summaryMap[key]) {
      summaryMap[key] = {
        companyId: rk.companyId,
        roleName: "", // Will be filled below
        customRoleId: rk.customRoleId,
        kpiCount: 0,
        totalWeight: 0,
      };
    }
    summaryMap[key].kpiCount += 1;
    summaryMap[key].totalWeight += Number(rk.weight);
  }

  // Fill roleName from customRoles
  const roleNameMap: Record<string, string> = {};
  customRoles.forEach(r => { roleNameMap[r.id] = r.name; });
  
  for (const key in summaryMap) {
    const roleId = summaryMap[key].customRoleId;
    if (roleId) {
      summaryMap[key].roleName = roleNameMap[roleId] || "Unknown Role";
    }
  }

  const serializedCompanies: CompanyRow[] = companies.map((c) => ({
    id: c.id,
    name: c.name,
    code: c.code,
  }));

  const serializedCustomRoles = customRoles.map(r => ({
    id: r.id,
    name: r.name,
    companyId: r.companyId
  }));

  return (
    <PageShell>
      <PageHeader
        title="Konfigurasi KPI"
        description="Konfigurasi KPI per perusahaan dan jabatan."
        icon={<IconTargetArrow className="size-5" />}
      />
      <KpiPageClient
        companies={serializedCompanies}
        customRoles={serializedCustomRoles}
        roleKpiSummary={Object.values(summaryMap)}
      />
    </PageShell>
  );
}
