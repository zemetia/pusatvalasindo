import prisma from "@/lib/prisma";

export type CreateBankAccountInput = {
  branchId: string;
  bankName: string;
  accountNumber?: string | null;
  accountName: string;
  currencyId: string;
  note?: string;
};

export type UpdateBankAccountInput = Partial<
  Omit<CreateBankAccountInput, "branchId" | "currencyId"> & { isActive: boolean }
>;

export const bankAccountRepository = {
  findAll: (branchId?: string, onlyActive = false) =>
    prisma.bankAccount.findMany({
      where: {
        ...(branchId ? { branchId } : {}),
        ...(onlyActive ? { isActive: true } : {}),
      },
      include: { branch: true, currency: true },
      orderBy: [{ branch: { name: "asc" } }, { bankName: "asc" }],
    }),

  findById: (id: string) =>
    prisma.bankAccount.findUnique({
      where: { id },
      include: { branch: true, currency: true },
    }),

  create: (data: CreateBankAccountInput) =>
    prisma.bankAccount.create({
      data,
      include: { branch: true, currency: true },
    }),

  update: (id: string, data: UpdateBankAccountInput) =>
    prisma.bankAccount.update({
      where: { id },
      data,
      include: { branch: true, currency: true },
    }),

  softDelete: (id: string) =>
    prisma.bankAccount.update({
      where: { id },
      data: { isActive: false },
    }),
};
