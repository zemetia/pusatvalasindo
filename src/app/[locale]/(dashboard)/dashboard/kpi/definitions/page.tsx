import prisma from "@/lib/prisma";
import { DefinitionsPageClient } from "@/components/admin/kpi/definitions-page-client";
import { PageShell, PageHeader, ErrorPanel } from "@/components/admin/page-shell";
import { IconListDetails } from "@tabler/icons-react";

export default async function KpiDefinitionsPage() {
  let definitions;
  try {
    definitions = await prisma.kpiDefinition.findMany({
      orderBy: [{ isActive: "desc" }, { scoringType: "asc" }, { name: "asc" }],
      include: { _count: { select: { roleKpis: true } } },
    });
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    return <ErrorPanel source="kpi/definitions/page" message={msg} />;
  }

  const serialized = definitions.map((d) => ({
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
      <PageHeader
        title="Definisi KPI"
        description="Katalog KPI: bagaimana tiap KPI dinilai dan siapa yang boleh mencatatnya. Angka target dan bobotnya disetel per jabatan."
        icon={<IconListDetails className="size-5" />}
      />
      <DefinitionsPageClient definitions={serialized} />
    </PageShell>
  );
}
