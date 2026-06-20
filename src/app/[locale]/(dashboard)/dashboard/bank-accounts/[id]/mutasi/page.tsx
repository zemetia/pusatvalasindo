import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { BankMutasiPageClient } from "@/components/admin/bank-mutasi-page-client";

type Params = { params: Promise<{ id: string }> };

export default async function BankMutasiPage({ params }: Params) {
  const { id } = await params;

  const account = await prisma.bankAccount.findUnique({
    where: { id },
    include: { branch: true, currency: true, mutations: { orderBy: { createdAt: "desc" } } },
  });

  if (!account) notFound();

  const serialized = {
    id: account.id,
    bankName: account.bankName,
    accountNumber: account.accountNumber ?? null,
    accountName: account.accountName,
    balance: account.balance.toString(),
    isActive: account.isActive,
    branch: { name: account.branch.name },
    currency: { code: account.currency.code },
    mutations: account.mutations.map((m) => ({
      id: m.id,
      type: m.type,
      amount: m.amount.toString(),
      balanceAfter: m.balanceAfter.toString(),
      description: m.description ?? null,
      createdAt: m.createdAt.toISOString(),
    })),
  };

  return <BankMutasiPageClient account={serialized} />;
}
