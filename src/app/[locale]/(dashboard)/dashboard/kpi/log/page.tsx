import prisma from "@/lib/prisma";
import { LogPageClient } from "@/components/admin/kpi/log-page-client";
import { PageShell, PageHeader, ErrorPanel } from "@/components/admin/page-shell";
import { IconReport } from "@tabler/icons-react";

export default async function KpiLogPage() {
  let users;
  try {
    // KPI per karyawan diambil client-side saat karyawan dipilih — memuat
    // seluruh konfigurasi setiap jabatan di sini akan sia-sia untuk halaman
    // yang hanya menilai satu orang dalam satu waktu.
    users = await prisma.user.findMany({
      where: { customRoleId: { not: null } },
      select: {
        id: true,
        name: true,
        customRoleId: true,
        isActive: true,
        branch: { select: { name: true } },
        customRole: { select: { name: true } },
      },
      orderBy: [{ branch: { name: "asc" } }, { name: "asc" }],
    });
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    return <ErrorPanel source="kpi/log/page" message={msg} />;
  }

  const serializedUsers = users.map((u) => ({
    id: u.id,
    name: u.name,
    role: u.customRole?.name || "Karyawan",
    customRoleId: u.customRoleId!,
    branchName: u.branch?.name ?? "—",
    isActive: u.isActive,
  }));

  return (
    <PageShell>
      <PageHeader
        title="Penilaian KPI"
        description="Catat kejadian KPI karyawan, setujui entri yang mereka isi sendiri, lalu kunci periodenya."
        icon={<IconReport className="size-5" />}
      />
      <LogPageClient users={serializedUsers} />
    </PageShell>
  );
}
