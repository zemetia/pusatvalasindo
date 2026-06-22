import prisma from "@/lib/prisma";
import { DefinitionsPageClient } from "@/components/admin/kpi/definitions-page-client";
import { PageHeader } from "@/components/admin/page-header";
import { IconListDetails } from "@tabler/icons-react";

export default async function KpiDefinitionsPage() {
  let definitions;
  try {
    definitions = await prisma.kpiDefinition.findMany({
      orderBy: [{ type: "asc" }, { name: "asc" }],
      include: { _count: { select: { roleKpis: true, logs: true } } },
    });
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    return (
      <div className="flex min-h-[400px] items-center justify-center p-8">
        <pre className="max-w-2xl whitespace-pre-wrap break-all rounded bg-destructive/10 p-6 text-sm text-destructive font-mono border border-destructive/30">
          {`[kpi/definitions/page — fetch error]\n\n${msg}`}
        </pre>
      </div>
    )
  }

  const serialized = definitions.map((d) => ({
    id: d.id,
    name: d.name,
    type: d.type as string,
    _count: d._count,
  }));

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <PageHeader
        title="Definisi KPI"
        description="Daftarkan nama KPI dan tipenya. Setiap KPI dapat dipakai oleh banyak jabatan."
        icon={<IconListDetails className="size-5" />}
      />
      <DefinitionsPageClient definitions={serialized} />
    </div>
  );
}
