import prisma from "@/lib/prisma";
import { BankAccountsPageClient } from "@/components/admin/bank-accounts-page-client";

export default async function BankAccountsPage() {
  const [accounts, branches, currencies, companies] = await Promise.all([
    prisma.bankAccount.findMany({
      include: { branch: true, currency: true },
      orderBy: [{ branch: { name: "asc" } }, { bankName: "asc" }],
    }),
    prisma.branch.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, companyId: true },
    }),
    prisma.currency.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
    prisma.company.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const serializedAccounts = accounts.map((a) => ({
    id: a.id,
    branchId: a.branchId,
    bankName: a.bankName,
    accountNumber: a.accountNumber ?? null,
    accountName: a.accountName,
    currencyId: a.currencyId,
    note: a.note,
    balance: a.balance.toString(),
    isActive: a.isActive,
    branch: { name: a.branch.name },
    currency: { code: a.currency.code },
  }));

  const serializedBranches = branches.map((b) => ({
    id: b.id,
    name: b.name,
    companyId: b.companyId,
  }));

  const serializedCurrencies = currencies.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
  }));

  return (
    <BankAccountsPageClient
      accounts={serializedAccounts}
      branches={serializedBranches}
      currencies={serializedCurrencies}
      companies={companies}
    />
  );
}
