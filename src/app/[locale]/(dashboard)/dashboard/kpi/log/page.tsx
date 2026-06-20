import prisma from "@/lib/prisma";
import { LogPageClient } from "@/components/admin/kpi/log-page-client";

export default async function KpiLogPage() {
  const [users, roleKpisRaw] = await Promise.all([
    prisma.user.findMany({
      where: {
        customRoleId: { not: null },
      },
      include: {
        branch: { select: { name: true } },
        customRole: { select: { name: true } },
      },
      orderBy: [{ branch: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.roleKpi.findMany({
      select: {
        id: true,
        customRoleId: true,
        kpiId: true,
        maxScore: true,
        targetValue: true,
        threshold: true,
        weight: true,
        definition: { select: { id: true, name: true, type: true } },
      },
      orderBy: [{ definition: { name: "asc" } }],
    }),
  ]);

  const serializedUsers = users.map((u) => ({
    id: u.id,
    name: u.name,
    role: u.customRole?.name || "Karyawan",
    customRoleId: u.customRoleId!,
    branchName: u.branch?.name ?? "—",
    isActive: u.isActive,
  }));

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

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <div>
        <h1 className="text-2xl font-semibold">Log KPI</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Catat pelanggaran dan target / omset karyawan.
        </p>
      </div>
      <LogPageClient
        users={serializedUsers}
        roleKpis={serializedRoleKpis}
      />
    </div>
  );
}
