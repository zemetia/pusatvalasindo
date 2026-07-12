import { redirect } from "next/navigation";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/permissions";
import { DailyBankForm } from "@/components/admin/bank/daily-bank-form";
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

  let user;
  try {
    user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        companyId: true,
        customRole: { select: { permissions: true } },
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    return (
      <div className="flex min-h-[400px] items-center justify-center p-8">
        <pre className="max-w-2xl whitespace-pre-wrap break-all rounded bg-destructive/10 p-6 text-sm text-destructive font-mono border border-destructive/30">
          {`[bank-harian/page — fetch error]\n\n${msg}`}
        </pre>
      </div>
    );
  }

  if (!user) redirect(`/${locale}/login`);

  const permissions = user.customRole?.permissions ?? [];
  if (!can(permissions, PERMISSIONS.BANK_VIEW)) {
    redirect(`/${locale}/dashboard`);
  }
  const canInput = can(permissions, PERMISSIONS.BANK_DAILY_INPUT);

  // Scoped ke PT sendiri kalau user punya companyId; kalau tidak (Admin/Owner/Akuntan lintas PT), bisa pilih semua PT aktif.
  const companies = await prisma.company.findMany({
    where: {
      isActive: true,
      ...(user.companyId ? { id: user.companyId } : {}),
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <PageHeader
        title="Bank Harian"
        description="Input saldo rekening bank per hari — kenaikan/penurunan dihitung otomatis dari entry sebelumnya."
        icon={<IconBuildingBank className="size-5" />}
      />
      <DailyBankForm
        companies={companies}
        defaultCompanyId={user.companyId}
        canInput={canInput}
      />
    </div>
  );
}
