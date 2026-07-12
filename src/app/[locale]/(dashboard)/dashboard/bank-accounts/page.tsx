import prisma from "@/lib/prisma";
import { BankAccountsPageClient } from "@/components/admin/bank-accounts-page-client";

export default async function BankAccountsPage() {
  const [accounts, companies] = await Promise.all([
    prisma.bankAccount.findMany({
      include: { company: true, currency: true },
      orderBy: [{ company: { name: "asc" } }, { bankName: "asc" }],
    }),
    prisma.company.findMany({
      where: { isActive: true },
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
    />
  );
}
