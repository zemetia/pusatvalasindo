import { notFound } from "next/navigation";
import { PageShell, ErrorPanel } from "@/components/admin/page-shell";
import prisma from "@/lib/prisma";
import { RoleKpiDetailClient } from "@/components/admin/kpi/role-kpi-detail-client";
import { requireResource } from "@/backend/helpers/authz";

interface PageProps {
  params: Promise<{ locale: string; companyId: string; roleName: string }>;
}

export default async function KpiDetailPage({ params }: PageProps) {
  const { locale, companyId, roleName } = await params;
  // Halaman detail bobot KPI satu jabatan — bagian dari Konfigurasi KPI, dan
  // sebelumnya sama sekali tidak dijaga di server.
  await requireResource("kpi.config", "view", locale);

  if (!roleName.startsWith("custom_")) {
    notFound();
  }
  const customRoleId = roleName.replace("custom_", "");

  let kpiDetailData;
  try {
    kpiDetailData = await Promise.all([
      prisma.company.findUnique({
        where: { id: companyId },
        select: { id: true, name: true, code: true },
      }),
      prisma.roleKpi.findMany({
        where: { companyId, customRoleId },
        select: {
          id: true,
          kpiId: true,
          customRoleId: true,
          weight: true,
          targetValue: true,
          basePoint: true,
          pointPerUnit: true,
          toleranceLimit: true,
          toleranceScope: true,
          inputSource: true,
          requiresApproval: true,
          requiresEvidence: true,
          isActive: true,
          definition: {
            select: {
              id: true,
              name: true,
              scoringType: true,
              unit: true,
              description: true,
              defaultInputSource: true,
              defaultRequiresApproval: true,
              defaultRequiresEvidence: true,
            },
          },
        },
        orderBy: [{ weight: "desc" }, { definition: { name: "asc" } }],
      }),
      prisma.kpiDefinition.findMany({
        orderBy: [{ scoringType: "asc" }, { name: "asc" }],
        include: { _count: { select: { roleKpis: true } } },
      }),
      prisma.custom_role.findUnique({ where: { id: customRoleId } }),
    ]);
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    return <ErrorPanel source="kpi/[companyId]/[roleName]/page" message={msg} />;
  }
  const [company, roleKpisRaw, definitions, customRole] = kpiDetailData;

  if (!company || !customRole) notFound();

  const serializedRoleKpis = roleKpisRaw.map((rk) => ({
    id: rk.id,
    kpiId: rk.kpiId,
    customRoleId: rk.customRoleId,
    weight: rk.weight.toString(),
    targetValue: rk.targetValue?.toString() ?? null,
    basePoint: rk.basePoint?.toString() ?? null,
    pointPerUnit: rk.pointPerUnit?.toString() ?? null,
    toleranceLimit: rk.toleranceLimit?.toString() ?? null,
    toleranceScope: rk.toleranceScope as string | null,
    inputSource: rk.inputSource as string | null,
    requiresApproval: rk.requiresApproval,
    requiresEvidence: rk.requiresEvidence,
    isActive: rk.isActive,
    definition: {
      id: rk.definition.id,
      name: rk.definition.name,
      scoringType: rk.definition.scoringType as string,
      unit: rk.definition.unit as string,
      description: rk.definition.description,
      defaultInputSource: rk.definition.defaultInputSource as string,
      defaultRequiresApproval: rk.definition.defaultRequiresApproval,
      defaultRequiresEvidence: rk.definition.defaultRequiresEvidence,
    },
  }));

  const serializedDefinitions = definitions.map((d) => ({
    id: d.id,
    code: d.code,
    name: d.name,
    objective: d.objective,
    description: d.description,
    scoringType: d.scoringType as string,
    unit: d.unit as string,
    direction: d.direction as string,
    defaultInputSource: d.defaultInputSource as string,
    defaultRequiresApproval: d.defaultRequiresApproval,
    defaultRequiresEvidence: d.defaultRequiresEvidence,
    systemSourceKey: d.systemSourceKey,
    isActive: d.isActive,
    _count: d._count,
  }));

  return (
    <PageShell>
      <RoleKpiDetailClient
        company={company}
        roleName={roleName}
        displayRoleName={customRole.name}
        roleKpis={serializedRoleKpis}
        definitions={serializedDefinitions}
      />
    </PageShell>
  );
}
