import prisma from "@/lib/prisma";
import { CalculatePageClient } from "@/components/admin/kpi/calculate-page-client";

export default async function KpiCalculatePage() {
  const users = await prisma.user.findMany({
    where: {
      customRoleId: { not: null },
    },
    include: {
      branch: { select: { name: true } },
      customRole: { select: { name: true } },
    },
    orderBy: [{ branch: { name: "asc" } }, { name: "asc" }],
  });

  const serializedUsers = users.map((u) => ({
    id: u.id,
    name: u.name,
    role: u.customRole?.name || "Karyawan",
    branchName: u.branch?.name ?? "—",
    isActive: u.isActive,
  }));

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <div>
        <h1 className="text-2xl font-semibold">Hitung KPI</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Hitung skor KPI bulanan karyawan dan lihat hasil grading.
        </p>
      </div>
      <CalculatePageClient users={serializedUsers} />
    </div>
  );
}
