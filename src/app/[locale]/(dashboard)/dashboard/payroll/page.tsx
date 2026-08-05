import prisma from "@/lib/prisma";
import { PayrollPageClient } from "@/components/admin/payroll/payroll-page-client";
import { PayrollRunPanel } from "@/components/admin/payroll/payroll-run-panel";
import { PageShell, PageHeader, ErrorPanel } from "@/components/admin/page-shell";
import { IconCoin } from "@tabler/icons-react";
import { getAuthzSubject } from "@/backend/helpers/authz";
import { getCaller } from "@/backend/helpers/get-admin-caller";
import { allows, resolve } from "@/lib/authz/resolve";
import { redirect } from "next/navigation";
import type { Prisma } from "@src/generated/prisma/client";

export default async function PayrollPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const caller = await getCaller();
  if (!caller) redirect(`/${locale}/login`);
  const subject = await getAuthzSubject();
  if (!subject) redirect(`/${locale}/login`);

  // Dua tingkat akses:
  //   • `payroll.manage` — hitung gaji karyawan orang lain, DI-SCOPE PER PT.
  //     Daftar karyawan disaring ke PT yang boleh dilihat, lalu halaman
  //     menyediakan filter PT sebelum orangnya dipilih.
  //   • `payroll.self`   — karyawan biasa hanya melihat slip gajinya sendiri.
  //
  // Jalur lama PAYROLL_VIEW_COMPANY (daftar PT di custom_role.payrollCompanyIds)
  // sudah dibuang: scope per-PT sekarang datang dari matriks izin.
  const manage = resolve(subject, "payroll.manage", "view");

  // `companyIds === null` berarti seluruh PT — jangan disamakan dengan [].
  const scopedCompanyIds = manage.companyIds;

  let where: Prisma.userWhereInput;
  if (manage.allowed) {
    where =
      scopedCompanyIds === null
        ? { customRoleId: { not: null } }
        : // PT karyawan diturunkan dari cabangnya (single source of truth).
          { customRoleId: { not: null }, branch: { companyId: { in: scopedCompanyIds } } };
  } else if (allows(subject, "payroll.self", "view")) {
    where = { id: caller.id };
  } else {
    redirect(`/${locale}/dashboard`);
  }

  // Daftar PT untuk filter di halaman. Hanya relevan saat mengelola gaji orang
  // lain; karyawan yang cuma melihat slipnya sendiri tidak perlu filter.
  const companies = manage.allowed
    ? await prisma.company.findMany({
        where: {
          isActive: true,
          ...(scopedCompanyIds === null ? {} : { id: { in: scopedCompanyIds } }),
        },
        orderBy: { name: "asc" },
        select: { id: true, name: true, code: true },
      })
    : [];

  let users;
  try {
    users = await prisma.user.findMany({
      where,
      include: {
        branch: { select: { name: true, companyId: true } },
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
    companyId: u.branch?.companyId ?? null,
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
      {/* Penggajian per bulan — hanya untuk yang berwenang mengelola gaji
          orang lain. Karyawan yang cuma melihat slipnya sendiri langsung ke
          kalkulator di bawah. */}
      {manage.allowed && companies.length > 0 && (
        <PayrollRunPanel companies={companies} locale={locale} />
      )}

      <PayrollPageClient users={serializedUsers} companies={companies} />
    </PageShell>
  );
}
