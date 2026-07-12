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
