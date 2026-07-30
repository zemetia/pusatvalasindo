import prisma from "@/lib/prisma";
import { requireResource } from "@/backend/helpers/authz";
import { BankAccountsPageClient } from "@/components/admin/bank-accounts-page-client";

export default async function BankAccountsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const authz = await requireResource("bank.accounts", "view", locale);

  // Rekening bank dimiliki 1 PT. PT mana saja yang terlihat datang dari scope
  // izin, bukan lagi dari "global atau bukan" — jadi sebuah jabatan bisa diberi
  // pandangan atas beberapa PT sekaligus.
  const [accounts, companies] = await Promise.all([
    prisma.bankAccount.findMany({
      where: { isActive: true, ...authz.where() },
      include: { company: true, currency: true },
      orderBy: [{ company: { name: "asc" } }, { bankName: "asc" }],
    }),
    prisma.company.findMany({
      where: { isActive: true, ...authz.where("id") },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  // Pemilih PT hanya berguna kalau memang ada lebih dari satu PT terjangkau.
  const canSelectCompany = companies.length > 1;

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
