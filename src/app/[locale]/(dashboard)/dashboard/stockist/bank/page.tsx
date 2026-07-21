import { redirect } from "next/navigation";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/permissions";
import { BankPageClient } from "@/components/admin/stockist/bank-page-client";
import { PageHeader } from "@/components/admin/page-header";
import { IconBuildingBank } from "@tabler/icons-react";

export default async function BankHarianPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect(`/${locale}/login`);

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      companyId: true,
      customRole: { select: { name: true, permissions: true } },
    },
  });
  if (!user) redirect(`/${locale}/login`);

  const permissions = user.customRole?.permissions ?? [];
  if (!can(permissions, PERMISSIONS.BANK_VIEW)) {
    redirect(`/${locale}/dashboard`);
  }
  const canManage = can(permissions, PERMISSIONS.BANK_DAILY_INPUT);

  // Saldo bank dimiliki 1 PT, dipakai bersama semua cabangnya. Hanya Super Admin/Owner
  // yang boleh memilih PT lain; role lain selalu di-scope ke PT sendiri.
  const roleName = user.customRole?.name;
  const canSelectCompany = roleName === "SUPER_ADMIN" || roleName === "OWNER";
  const companies = await prisma.company.findMany({
    where: {
      isActive: true,
      ...(canSelectCompany ? {} : { id: user.companyId ?? "" }),
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const defaultCompanyId = canSelectCompany ? null : user.companyId;

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <PageHeader
        title="Saldo Bank Harian"
        description="Input & lihat saldo bank harian per PT."
        icon={<IconBuildingBank className="size-5" />}
      />
      <BankPageClient
        companies={companies}
        defaultCompanyId={defaultCompanyId}
        canManage={canManage}
        canSelectCompany={canSelectCompany}
      />
    </div>
  );
}
