import prisma from "@/lib/prisma";
import { BranchesPageClient } from "@/components/admin/branches-page-client";

export default async function BranchesPage() {
  const [branches, companies] = await Promise.all([
    prisma.branch.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: { select: { users: true, stockItems: true } },
      },
    }),
    prisma.company.findMany({
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <div>
        <h1 className="text-2xl font-semibold">Cabang</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Kelola seluruh cabang bisnis per perusahaan
        </p>
      </div>

      <BranchesPageClient
        companies={companies}
        branches={branches.map((b) => ({
          ...b,
          companyId: b.companyId ?? undefined,
        }))}
      />
    </div>
  );
}
