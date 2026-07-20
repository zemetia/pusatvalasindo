import { redirect } from "next/navigation";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/permissions";
import { StockistHeadConfirmationClient } from "@/components/admin/stockist/stockist-head-confirmation-client";
import { PageHeader } from "@/components/admin/page-header";
import { IconClipboardCheck } from "@tabler/icons-react";

export default async function StockistHeadConfirmationPage({
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
  if (!can(permissions, PERMISSIONS.STOCKIST_VERIFY)) {
    redirect(`/${locale}/dashboard`);
  }

  const isSuperAdmin = user.customRole?.name === "SUPER_ADMIN";

  // Konfirmasi kepala cabang dimiliki 1 PT — scoped ke PT sendiri kalau user punya companyId;
  // kalau tidak (Super Admin/Owner), bisa pilih semua PT aktif.
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
        title="Cross-Check Stock"
        description="Hitung ulang total stock & kas oleh kepala cabang, dibandingkan otomatis dengan total sistem."
        icon={<IconClipboardCheck className="size-5" />}
      />
      <StockistHeadConfirmationClient
        companies={companies}
        defaultCompanyId={user.companyId}
        isSuperAdmin={isSuperAdmin}
      />
    </div>
  );
}
