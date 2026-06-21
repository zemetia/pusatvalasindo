import prisma from "@/lib/prisma";
import { PayrollPageClient } from "@/components/admin/payroll/payroll-page-client";

export default async function PayrollPage() {
  let users;
  try {
    users = await prisma.user.findMany({
      where: { customRoleId: { not: null } },
      include: {
        branch: { select: { name: true } },
        customRole: { select: { name: true } },
      },
      orderBy: [{ branch: { name: "asc" } }, { name: "asc" }],
    });
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    return (
      <div className="flex min-h-[400px] items-center justify-center p-8">
        <pre className="max-w-2xl whitespace-pre-wrap break-all rounded bg-destructive/10 p-6 text-sm text-destructive font-mono border border-destructive/30">
          {`[payroll/page — fetch error]\n\n${msg}`}
        </pre>
      </div>
    )
  }

  const serializedUsers = users.map((u) => ({
    id: u.id,
    name: u.name,
    role: u.customRole?.name || "Karyawan",
    branchName: u.branch?.name ?? "—",
    baseSalary: u.baseSalary ? Number(u.baseSalary) : null,
    mealAllowance: u.mealAllowance ? Number(u.mealAllowance) : null,
    transportAllowance: u.transportAllowance ? Number(u.transportAllowance) : null,
    isActive: u.isActive,
  }));

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <div>
        <h1 className="text-2xl font-semibold">Hitung Gaji</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Hitung gaji bulanan karyawan berdasarkan gaji pokok dan hasil KPI.
        </p>
      </div>
      <PayrollPageClient users={serializedUsers} />
    </div>
  );
}
