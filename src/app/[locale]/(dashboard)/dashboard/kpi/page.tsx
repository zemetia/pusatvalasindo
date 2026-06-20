import prisma from "@/lib/prisma";
import {
  KpiPageClient,
  CompanyRow,
  RoleKpiSummaryRow,
} from "@/components/admin/kpi-page-client";

export default async function KpiPage() {
  const [companies, roleKpisRaw, customRoles] = await Promise.all([
    prisma.company.findMany({ orderBy: { name: "asc" } }),
    prisma.roleKpi.findMany({
      select: {
        companyId: true,
        customRoleId: true,
        maxScore: true,
      },
    }),
    prisma.custom_role.findMany({
      orderBy: { name: "asc" },
    }),
  ]);

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
    summaryMap[key].totalWeight += Number(rk.maxScore);
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
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <div>
        <h1 className="text-2xl font-semibold">Konfigurasi KPI</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Konfigurasi KPI per perusahaan dan jabatan.
        </p>
      </div>
      <KpiPageClient
        companies={serializedCompanies}
        customRoles={serializedCustomRoles}
        roleKpiSummary={Object.values(summaryMap)}
      />
    </div>
  );
}
