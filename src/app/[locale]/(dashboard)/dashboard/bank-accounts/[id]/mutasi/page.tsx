import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { BankMutasiPageClient } from "@/components/admin/bank-mutasi-page-client";

type Params = { params: Promise<{ id: string }> };

export default async function BankMutasiPage({ params }: Params) {
  const { id } = await params;

  let account;
  try {
    account = await prisma.bankAccount.findUnique({
      where: { id },
      include: { company: true, currency: true, mutations: { orderBy: { createdAt: "desc" } } },
    });
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    return (
      <div className="flex min-h-[400px] items-center justify-center p-8">
        <pre className="max-w-2xl whitespace-pre-wrap break-all rounded bg-destructive/10 p-6 text-sm text-destructive font-mono border border-destructive/30">
          {`[bank-accounts/[id]/mutasi/page — fetch error]\n\n${msg}`}
        </pre>
      </div>
    )
  }

  if (!account) notFound();

  const serialized = {
    id: account.id,
    bankName: account.bankName,
    accountNumber: account.accountNumber ?? null,
    accountName: account.accountName,
    balance: account.balance.toString(),
    isActive: account.isActive,
    company: { name: account.company.name },
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
