import { IconBuildingSkyscraper } from "@tabler/icons-react";
import { requireResource } from "@/backend/helpers/authz";
import { companyService } from "@/backend/services/company.service";
import { CompaniesPageClient } from "@/components/admin/companies-page-client";
import { PageShell, PageHeader, ErrorPanel } from "@/components/admin/page-shell";

export default async function CompaniesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // Resource global: PT adalah dimensi scope itu sendiri, jadi daftarnya tidak
  // disaring per PT — yang berhak melihat halaman ini melihat seluruh PT.
  const authz = await requireResource("companies", "view", locale);

  let companies;
  try {
    companies = await companyService.listWithCounts();
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    return <ErrorPanel source="pt/page" message={msg} />;
  }

  return (
    <PageShell>
      <PageHeader
        title="PT"
        description="Kelola badan usaha yang menaungi seluruh cabang dan karyawan"
        icon={<IconBuildingSkyscraper className="size-5" />}
      />

      <CompaniesPageClient
        companies={companies}
        canManage={authz.can("companies", "write")}
      />
    </PageShell>
  );
}
