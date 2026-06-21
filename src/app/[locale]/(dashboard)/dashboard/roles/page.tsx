import prisma from "@/lib/prisma";
import { RolesPageClient } from "@/components/admin/roles-page-client";
import { IconShieldLock } from "@tabler/icons-react";

export default async function RolesPage() {
  let result;
  try {
    result = await Promise.all([
      prisma.custom_role.findMany({
        orderBy: { name: "asc" },
        include: {
          _count: { select: { users: true } },
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
          {`[roles/page — fetch error]\n\n${msg}`}
        </pre>
      </div>
    )
  }
  const [roles, companies] = result;

  return (
    <div className="flex flex-col gap-8 px-4 lg:px-8 py-6">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-primary/10 text-primary shadow-sm border border-primary/20">
            <IconShieldLock className="size-6" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Manajemen Role</h1>
        </div>
        <p className="text-[14px] text-slate-500 font-medium max-w-2xl leading-relaxed mt-1">
          Kelola hak akses dan tanggung jawab personel berdasarkan perusahaan untuk memastikan keamanan dan efisiensi operasional.
        </p>
      </div>

      <RolesPageClient
        companies={companies}
        roles={roles.map((r) => ({
          ...r,
          companyId: r.companyId ?? null,
        }))}
      />
    </div>
  );
}
