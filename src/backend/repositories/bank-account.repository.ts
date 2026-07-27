import prisma from "@/lib/prisma";

export type CreateBankAccountInput = {
  companyId: string;
  bankName: string;
  accountNumber?: string | null;
  accountName: string;
  currencyId: string;
  note?: string;
};

export type UpdateBankAccountInput = Partial<
  Omit<CreateBankAccountInput, "companyId" | "currencyId"> & { isActive: boolean }
>;

export const bankAccountRepository = {
  findAll: (companyId?: string, onlyActive = false) =>
    prisma.bankAccount.findMany({
      where: {
        ...(companyId ? { companyId } : {}),
        ...(onlyActive ? { isActive: true } : {}),
      },
      include: { company: true, currency: true },
      orderBy: [{ company: { name: "asc" } }, { bankName: "asc" }],
    }),

  // Lean list for the Bank Harian daily page (single PT). Drops the `company` relation entirely
  // (unused there, and loaded as its own query on this client) and orders by sortOrder instead of
  // company.name — no cross-table JOIN, and only `currency.code` is pulled. Selecting scalars keeps
  // the round-trip count minimal versus the shared `findAll` (accounts + company + currency).
  findActiveForDaily: (companyId: string) =>
    prisma.bankAccount.findMany({
      where: { companyId, isActive: true },
      select: {
        id: true,
        bankName: true,
        accountNumber: true,
        accountName: true,
        balance: true,
        sortOrder: true,
        currency: { select: { code: true } },
      },
      orderBy: [{ sortOrder: "asc" }, { bankName: "asc" }],
    }),

  findById: (id: string) =>
    prisma.bankAccount.findUnique({
      where: { id },
      include: { company: true, currency: true },
    }),

  create: (data: CreateBankAccountInput) =>
    prisma.bankAccount.create({
      data,
      include: { company: true, currency: true },
    }),

  update: (id: string, data: UpdateBankAccountInput) =>
    prisma.bankAccount.update({
      where: { id },
      data,
      include: { company: true, currency: true },
    }),

  softDelete: (id: string) =>
    prisma.bankAccount.update({
      where: { id },
      data: { isActive: false },
    }),

  countRelated: async (id: string) => {
    const [mutations, dailyEntries] = await Promise.all([
      prisma.bankMutation.count({ where: { bankAccountId: id } }),
      prisma.dailyBankEntry.count({ where: { bankAccountId: id } }),
    ]);
    return mutations + dailyEntries;
  },

  hardDelete: (id: string) => prisma.bankAccount.delete({ where: { id } }),
};
