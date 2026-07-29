import prisma from "@/lib/prisma";
import { PayrollPageClient } from "@/components/admin/payroll/payroll-page-client";
import { PageShell, PageHeader, ErrorPanel } from "@/components/admin/page-shell";
import { IconCoin } from "@tabler/icons-react";
import { getCaller } from "@/backend/helpers/get-admin-caller";
import { can, PERMISSIONS } from "@/lib/permissions";
import { redirect } from "next/navigation";
import type { Prisma } from "@src/generated/prisma/client";

export default async function PayrollPage() {
  const caller = await getCaller();
  if (!caller) redirect("/login");

  let where: Prisma.userWhereInput;
  if (can(caller.permissions, PERMISSIONS.PAYROLL_VIEW_ALL)) {
    where = { customRoleId: { not: null } };
  } else if (can(caller.permissions, PERMISSIONS.PAYROLL_VIEW_COMPANY)) {
    const allowedCompanyIds = caller.payrollCompanyIds.length > 0 ? caller.payrollCompanyIds : [caller.companyId ?? ""];
    // PT user diturunkan dari cabangnya (single source of truth).
    where = { customRoleId: { not: null }, branch: { companyId: { in: allowedCompanyIds } } };
  } else if (can(caller.permissions, PERMISSIONS.PAYROLL_VIEW_OWN)) {
    where = { id: caller.id };
  } else {
    redirect("/dashboard");
  }

  let users;
  try {
    users = await prisma.user.findMany({
      where,
      include: {
        branch: { select: { name: true } },
        customRole: { select: { name: true } },
      },
      orderBy: [{ branch: { name: "asc" } }, { name: "asc" }],
    });
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    return (
      <ErrorPanel source="payroll/page" message={msg} />
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
    positionAllowance: u.positionAllowance ? Number(u.positionAllowance) : null,
    bpjsKesehatan: u.bpjsKesehatan ? Number(u.bpjsKesehatan) : null,
    isActive: u.isActive,
  }));

  return (
    <PageShell>
      <PageHeader
        title="Hitung Gaji"
        description="Hitung gaji bulanan karyawan berdasarkan gaji pokok dan hasil KPI."
        icon={<IconCoin className="size-5" />}
      />
      <PayrollPageClient users={serializedUsers} />
    </PageShell>
  );
}
