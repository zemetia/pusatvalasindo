import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { RoleKpiDetailClient } from "@/components/admin/kpi/role-kpi-detail-client";

interface PageProps {
  params: Promise<{ companyId: string; roleName: string }>;
}

export default async function KpiDetailPage({ params }: PageProps) {
  const { companyId, roleName } = await params;

  if (!roleName.startsWith("custom_")) {
    notFound();
  }
  const customRoleId = roleName.replace("custom_", "");

  const [company, roleKpisRaw, definitions, customRole] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true, code: true },
    }),
    prisma.roleKpi.findMany({
      where: { 
        companyId, 
        customRoleId: customRoleId
      },
      select: {
        id: true,
        kpiId: true,
        customRoleId: true,
        maxScore: true,
        targetValue: true,
        threshold: true,
        weight: true,
        definition: { select: { id: true, name: true, type: true } },
      },
      orderBy: { definition: { name: "asc" } },
    }),
    prisma.kpiDefinition.findMany({
      orderBy: [{ type: "asc" }, { name: "asc" }],
    }),
    prisma.custom_role.findUnique({ where: { id: customRoleId } })
  ]);

  if (!company || !customRole) notFound();
  
  const displayRoleName = customRole.name;

  const serializedRoleKpis = roleKpisRaw.map((rk) => ({
    id: rk.id,
    kpiId: rk.kpiId,
    customRoleId: rk.customRoleId,
    maxScore: rk.maxScore.toString(),
    targetValue: rk.targetValue?.toString() ?? null,
    threshold: rk.threshold?.toString() ?? null,
    weight: rk.weight.toString(),
    definition: rk.definition,
  }));

  const serializedDefinitions = definitions.map((d) => ({
    id: d.id,
    name: d.name,
    type: d.type as string,
    _count: { roleKpis: 0, logs: 0 },
  }));

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <RoleKpiDetailClient
        company={company}
        roleName={roleName}
        displayRoleName={displayRoleName}
        roleKpis={serializedRoleKpis}
        definitions={serializedDefinitions}
      />
    </div>
  );
}
