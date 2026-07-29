import { notFound } from "next/navigation";
import { ErrorPanel } from "@/components/admin/page-shell";
import prisma from "@/lib/prisma";
import { isGlobalRole, PERMISSIONS } from "@/lib/permissions";
import { requirePageCaller } from "@/backend/helpers/page-access";
import { BankMutasiPageClient } from "@/components/admin/bank-mutasi-page-client";

type Params = { params: Promise<{ id: string; locale: string }> };

export default async function BankMutasiPage({ params }: Params) {
  const { id, locale } = await params;

  const caller = await requirePageCaller(PERMISSIONS.BANK_VIEW, locale);
  const canSelectCompany = isGlobalRole(caller.roleName);

  let account;
  try {
    account = await prisma.bankAccount.findUnique({
      where: { id },
      include: { company: true, currency: true, mutations: { orderBy: { createdAt: "desc" } } },
    });
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    return (
      <ErrorPanel source="bank-accounts/[id]/mutasi/page" message={msg} />
    )
  }

  if (!account) notFound();

  // Kepala Cabang & role non-global hanya boleh melihat mutasi rekening PT-nya sendiri.
  // PT caller diturunkan dari cabangnya (single source of truth).
  if (!canSelectCompany && account.companyId !== caller.companyId) notFound();

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
