import prisma from "@/lib/prisma";
import { SalaryComponentsPageClient } from "@/components/admin/payroll/salary-components-page-client";
import { PageShell, PageHeader, ErrorPanel } from "@/components/admin/page-shell";
import { IconCoin } from "@tabler/icons-react";
import { requireResource } from "@/backend/helpers/authz";
import { salaryComponentService } from "@/backend/services/salary-component.service";

export default async function SalaryComponentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const authz = await requireResource("payroll.components", "view", locale);

  // `companyIds === null` berarti seluruh PT — hanya scope inilah yang boleh
  // membuat komponen global (companyId null), karena komponen global ikut
  // dipakai PT yang mungkin di luar jangkauan admin PT tunggal.
  const scopedCompanyIds = authz.companyIds;
  const canCreateGlobal = scopedCompanyIds === null;

  let components;
  let companies;
  let usage;
  try {
    [components, companies, usage] = await Promise.all([
      salaryComponentService.list(scopedCompanyIds),
      prisma.company.findMany({
        where: {
          isActive: true,
          ...(scopedCompanyIds === null ? {} : { id: { in: scopedCompanyIds } }),
        },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.userSalaryComponent.groupBy({
        by: ["componentId"],
        _count: { _all: true },
      }),
    ]);
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    return <ErrorPanel source="payroll/komponen/page" message={msg} />;
  }

  const usageByComponent = Object.fromEntries(
    usage.map((u) => [u.componentId, u._count._all])
  );

  return (
    <PageShell>
      <PageHeader
        title="Komponen Gaji"
        description="Tunjangan dan potongan tetap per bulan di luar gaji pokok, uang makan, transport, jabatan, dan BPJS. Nilainya diisi per karyawan di halaman Pengguna."
        icon={<IconCoin className="size-5" />}
      />
      <SalaryComponentsPageClient
        components={components}
        companies={companies}
        canCreateGlobal={canCreateGlobal}
        usageByComponent={usageByComponent}
      />
    </PageShell>
  );
}
