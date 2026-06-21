import prisma from "@/lib/prisma";
import { BranchesPageClient } from "@/components/admin/branches-page-client";

export default async function BranchesPage() {
  let result;
  try {
    result = await Promise.all([
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
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    return (
      <div className="flex min-h-[400px] items-center justify-center p-8">
        <pre className="max-w-2xl whitespace-pre-wrap break-all rounded bg-destructive/10 p-6 text-sm text-destructive font-mono border border-destructive/30">
          {`[branches/page — fetch error]\n\n${msg}`}
        </pre>
      </div>
    )
  }
  const [branches, companies] = result;

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
