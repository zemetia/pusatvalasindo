import prisma from "@/lib/prisma";
import { DefinitionsPageClient } from "@/components/admin/kpi/definitions-page-client";

export default async function KpiDefinitionsPage() {
  const definitions = await prisma.kpiDefinition.findMany({
    orderBy: [{ type: "asc" }, { name: "asc" }],
    include: { _count: { select: { roleKpis: true, logs: true } } },
  });

  const serialized = definitions.map((d) => ({
    id: d.id,
    name: d.name,
    type: d.type as string,
    _count: d._count,
  }));

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <div>
        <h1 className="text-2xl font-semibold">Definisi KPI</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Daftarkan nama KPI dan tipenya. Setiap KPI dapat dipakai oleh banyak jabatan.
        </p>
      </div>
      <DefinitionsPageClient definitions={serialized} />
    </div>
  );
}
