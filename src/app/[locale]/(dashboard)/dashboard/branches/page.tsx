import prisma from "@/lib/prisma";
import { BranchesPageClient } from "@/components/admin/branches-page-client";
import { PageShell, PageHeader, ErrorPanel } from "@/components/admin/page-shell";
import { IconBuilding } from "@tabler/icons-react";
import { requireResource } from "@/backend/helpers/authz";
import { resolve } from "@/lib/authz/resolve";

export default async function BranchesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // Cabang dimiliki satu PT, jadi PT mana yang terlihat datang dari scope izin
  // — bukan lagi dari satu permission tunggal yang selalu berarti "semua PT".
  const authz = await requireResource("branches", "view", locale);

  // Sumbu tulis diresolusi tersendiri: boleh melihat cabang PT A+B belum tentu
  // boleh mengubahnya. `null` = seluruh PT.
  const writeDecision = resolve(authz.subject, "branches", "write");
  const writableCompanyIds = writeDecision.allowed ? writeDecision.companyIds : [];

  let result;
  try {
    result = await Promise.all([
      prisma.branch.findMany({
        where: authz.where(),
        orderBy: { name: "asc" },
        include: {
          _count: { select: { users: true, stockItems: true } },
        },
      }),
      prisma.company.findMany({
        where: authz.where("id"),
        orderBy: { name: "asc" },
      }),
    ]);
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    return (
      <ErrorPanel source="branches/page" message={msg} />
    )
  }
  const [branches, companies] = result;

  return (
    <PageShell>
      <PageHeader
        title="Cabang"
        description="Kelola seluruh cabang bisnis per perusahaan"
        icon={<IconBuilding className="size-5" />}
      />

      <BranchesPageClient
        companies={companies}
        writableCompanyIds={writableCompanyIds}
        branches={branches.map((b) => ({
          ...b,
          companyId: b.companyId ?? undefined,
        }))}
      />
    </PageShell>
  );
}
