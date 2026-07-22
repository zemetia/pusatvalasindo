import prisma from "@/lib/prisma";
import { isGlobalRole, PERMISSIONS } from "@/lib/permissions";
import { requirePageCaller } from "@/backend/helpers/page-access";
import { BankAccountsPageClient } from "@/components/admin/bank-accounts-page-client";

export default async function BankAccountsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const caller = await requirePageCaller(PERMISSIONS.BANK_VIEW, locale);

  // Rekening bank dimiliki 1 PT. Global role (Super Admin/Owner) melihat rekening
  // semua PT; role lain (mis. Kepala Cabang) di-scope ke PT sendiri (dari cabangnya).
  const canSelectCompany = isGlobalRole(caller.roleName);
  const effectiveCompanyId = caller.companyId ?? "";

  const [accounts, companies] = await Promise.all([
    prisma.bankAccount.findMany({
      where: {
        isActive: true,
        ...(canSelectCompany ? {} : { companyId: effectiveCompanyId }),
      },
      include: { company: true, currency: true },
      orderBy: [{ company: { name: "asc" } }, { bankName: "asc" }],
    }),
    prisma.company.findMany({
      where: {
        isActive: true,
        ...(canSelectCompany ? {} : { id: effectiveCompanyId }),
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const serializedAccounts = accounts.map((a) => ({
    id: a.id,
    companyId: a.companyId,
    bankName: a.bankName,
    accountNumber: a.accountNumber ?? null,
    accountName: a.accountName,
    currencyId: a.currencyId,
    note: a.note,
    balance: a.balance.toString(),
    isActive: a.isActive,
    company: { name: a.company.name },
    currency: { code: a.currency.code },
  }));

  const serializedCurrencies = await prisma.currency.findMany({
    where: { isActive: true },
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true },
  });

  return (
    <BankAccountsPageClient
      accounts={serializedAccounts}
      currencies={serializedCurrencies}
      companies={companies}
      canSelectCompany={canSelectCompany}
    />
  );
}
