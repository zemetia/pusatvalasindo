import prisma from "@/lib/prisma";
import { BranchesPageClient } from "@/components/admin/branches-page-client";
import { PageHeader } from "@/components/admin/page-header";
import { IconBuilding } from "@tabler/icons-react";
import { getCaller } from "@/backend/helpers/get-admin-caller";
import { can, PERMISSIONS } from "@/lib/permissions";
import { redirect } from "next/navigation";

export default async function BranchesPage() {
  // Hanya Owner & Super Admin (pemegang BRANCHES_VIEW) yang boleh melihat halaman
  // Cabang — Kepala Cabang dan role lain diarahkan kembali ke dashboard.
  const caller = await getCaller();
  if (!caller || !can(caller.permissions, PERMISSIONS.BRANCHES_VIEW)) {
    redirect("/dashboard");
  }

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
      <PageHeader
        title="Cabang"
        description="Kelola seluruh cabang bisnis per perusahaan"
        icon={<IconBuilding className="size-5" />}
      />

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
