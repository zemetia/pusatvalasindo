"use client";

import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
      <div className="text-center text-muted-foreground py-10">
        Belum ada data perusahaan.
      </div>
    );
  }

  return (
    <Tabs defaultValue={companies[0].id} className="flex flex-col gap-4">
      <TabsList className="w-fit">
        {companies.map((c) => (
          <TabsTrigger key={c.id} value={c.id}>
            {c.name}
          </TabsTrigger>
        ))}
      </TabsList>
      {companies.map((c) => {
        const companyRoles = customRoles.filter((r) => r.companyId === c.id);
        
        return (
          <TabsContent key={c.id} value={c.id} className="mt-0">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {/* Custom Roles for this company */}
              {companyRoles.map((role) => {
                const summary = roleKpiSummary.find(
                  (s) => s.companyId === c.id && s.customRoleId === role.id
                );
                const isComplete = !!summary && Math.abs(summary.totalWeight - 1) < 0.001;
                if (!summary) {
                  return (
                    <Card
                      key={role.id}
                      className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50 border-dashed"
                      onClick={() => router.push(`/dashboard/kpi/${c.id}/custom_${role.id}`)}
                    >
                      <CardContent className="py-6 flex flex-col items-center gap-2 text-center">
                        <span className="text-2xl">📋</span>
                        <CardTitle className="text-sm font-semibold">{role.name}</CardTitle>
                        <p className="text-xs text-muted-foreground">Belum ada KPI</p>
                        <span className="mt-1 inline-flex items-center rounded-md border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary">
                          + Atur KPI Jabatan Ini
                        </span>
                      </CardContent>
                    </Card>
                  );
                }

                return (
                  <Card
                    key={role.id}
                    className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50"
                    onClick={() => router.push(`/dashboard/kpi/${c.id}/custom_${role.id}`)}
                  >
                    <CardHeader className="pb-2 pt-4">
                      <CardTitle className="text-sm font-semibold">{role.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="pb-4 flex flex-wrap gap-2">
                      <Badge variant="secondary">{summary.kpiCount} KPI</Badge>
                      <Badge variant={isComplete ? "default" : "destructive"}>
                        {(summary.totalWeight * 100).toFixed(0)}%
                        {isComplete ? " ✓" : " — belum 100%"}
                      </Badge>
                    </CardContent>
                  </Card>
                );
              })}


              {companyRoles.length === 0 && (
                <div className="col-span-full py-10 text-center border-2 border-dashed rounded-xl text-muted-foreground">
                  Belum ada role/jabatan untuk perusahaan ini. <br />
                  <span className="text-xs">Silakan tambahkan di menu Role & Akses.</span>
                </div>
              )}
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

