import { redirect } from "next/navigation";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/permissions";
import Link from "next/link";
import { StockistTabs } from "@/components/admin/stockist/stockist-tabs";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { IconHistory, IconWallet } from "@tabler/icons-react";

export default async function StockistPage({
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
      customRole: { select: { permissions: true } },
    },
  });
  if (!user) redirect(`/${locale}/login`);

  const permissions = user.customRole?.permissions ?? [];
  if (!can(permissions, PERMISSIONS.STOCKIST_VIEW)) {
    redirect(`/${locale}/dashboard`);
  }
  const canManage = can(permissions, PERMISSIONS.STOCKIST_MANAGE);

  // Stockist & Kas dimiliki 1 PT, dipakai bersama semua cabangnya. Scoped ke PT sendiri kalau
  // user punya companyId; kalau tidak (Admin/Owner/Akuntan), bisa pilih semua PT aktif.
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
        title="Stockist"
        description="Stock mata uang & kas tunai per pocket, per PT — terpisah dari rekening bank."
        icon={<IconWallet className="size-5" />}
        action={
          <Button variant="outline" size="sm" asChild>
            <Link href={`/${locale}/dashboard/stockist/history`}>
              <IconHistory className="size-4" />
              Riwayat
            </Link>
          </Button>
        }
      />
      <StockistTabs
        companies={companies}
        defaultCompanyId={user.companyId}
        canManage={canManage}
      />
    </div>
  );
}
