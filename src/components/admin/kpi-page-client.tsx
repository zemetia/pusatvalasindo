"use client";

import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { SectionCard, EmptyState } from "@/components/admin/page-shell";
import { IconChevronRight, IconTargetArrow } from "@tabler/icons-react";

export type CompanyRow = {
  id: string;
  name: string;
  code: string;
};

export type RoleKpiSummaryRow = {
  companyId: string;
  roleName?: string;
  customRoleId?: string;
  kpiCount: number;
  totalWeight: number;
};

export type CustomRoleRow = {
  id: string;
  name: string;
  companyId: string | null;
};

function KonfigurasiTab({
  companies,
  customRoles,
  roleKpiSummary,
}: {
  companies: CompanyRow[];
  customRoles: CustomRoleRow[];
  roleKpiSummary: RoleKpiSummaryRow[];
}) {
  const router = useRouter();

  if (companies.length === 0) {
    return (
      <SectionCard padded={false}>
        <EmptyState
          icon={<IconTargetArrow className="size-5" />}
          title="Belum ada data perusahaan"
          description="Tambahkan perusahaan terlebih dahulu sebelum menyusun KPI per jabatan."
        />
      </SectionCard>
    );
  }

  return (
    <Tabs defaultValue={companies[0].id} className="flex flex-col gap-4">
      <TabsList>
        {companies.map((c) => (
          <TabsTrigger key={c.id} value={c.id}>
            {c.name}
          </TabsTrigger>
        ))}
      </TabsList>
      {companies.map((c) => {
        const companyRoles = customRoles.filter((r) => r.companyId === c.id);

        if (companyRoles.length === 0) {
          return (
            <TabsContent key={c.id} value={c.id} className="mt-0">
              <SectionCard padded={false}>
                <EmptyState
                  icon={<IconTargetArrow className="size-5" />}
                  title="Belum ada role/jabatan untuk perusahaan ini"
                  description="Tambahkan role terlebih dahulu di menu Role & Akses."
                />
              </SectionCard>
            </TabsContent>
          );
        }

        return (
          <TabsContent key={c.id} value={c.id} className="mt-0">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {companyRoles.map((role) => {
                const summary = roleKpiSummary.find(
                  (s) => s.companyId === c.id && s.customRoleId === role.id
                );
                // Bobot KPI satu jabatan harus berjumlah tepat 100%.
                const isComplete = !!summary && Math.abs(summary.totalWeight - 1) < 0.001;

                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => router.push(`/dashboard/kpi/${c.id}/custom_${role.id}`)}
                    className="bg-card hover:border-primary/40 group flex flex-col gap-3 rounded-xl border p-4 text-left shadow-sm transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{role.name}</span>
                      <IconChevronRight className="text-muted-foreground group-hover:text-foreground size-4 shrink-0 transition-colors" />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {summary ? (
                        <>
                          <Badge variant="soft">{summary.kpiCount} KPI</Badge>
                          <Badge variant={isComplete ? "success" : "warning"}>
                            Bobot {(summary.totalWeight * 100).toFixed(0)}%
                            {isComplete ? "" : " — belum 100%"}
                          </Badge>
                        </>
                      ) : (
                        <Badge variant="outline">Belum ada KPI</Badge>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </TabsContent>
        );
      })}
    </Tabs>
  );
}

export function KpiPageClient({
  companies,
  customRoles,
  roleKpiSummary,
}: {
  companies: CompanyRow[];
  customRoles: CustomRoleRow[];
  roleKpiSummary: RoleKpiSummaryRow[];
}) {
  return <KonfigurasiTab companies={companies} customRoles={customRoles} roleKpiSummary={roleKpiSummary} />;
}

