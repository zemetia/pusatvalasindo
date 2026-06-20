import prisma from "@/lib/prisma";
import { bankMutationRepository } from "@/backend/repositories/bank-mutation.repository";
import { NotFoundError, ValidationError } from "@/backend/errors/app-error";
import { BankMutationType } from "@src/generated/prisma/client";

export type CreateBankMutationInput = {
  bankAccountId: string;
  type: BankMutationType;
  amount: number;
  description?: string;
  createdBy?: string;
};

export const bankMutationService = {
  getByAccount: async (bankAccountId: string) => {
    const account = await prisma.bankAccount.findUnique({ where: { id: bankAccountId } });
    if (!account) throw new NotFoundError("Bank account not found");
    return bankMutationRepository.findByAccount(bankAccountId);
  },

  getById: async (id: string) => {
    const mutation = await bankMutationRepository.findById(id);
    if (!mutation) throw new NotFoundError("Bank mutation not found");
    return mutation;
  },

  create: async (data: CreateBankMutationInput) => {
    if (data.amount <= 0) throw new ValidationError("Amount must be greater than 0");

    return prisma.$transaction(async (tx) => {
      const account = await tx.bankAccount.findUnique({ where: { id: data.bankAccountId } });
      if (!account) throw new NotFoundError("Bank account not found");
      if (!account.isActive) throw new ValidationError("Cannot mutate an inactive bank account");

      const currentBalance = Number(account.balance);
      const balanceAfter =
        data.type === BankMutationType.CREDIT
          ? currentBalance + data.amount
          : currentBalance - data.amount;

      await tx.bankAccount.update({
        where: { id: data.bankAccountId },
        data: { balance: balanceAfter },
      });

      return tx.bankMutation.create({
        data: {
          bankAccountId: data.bankAccountId,
          type: data.type,
          amount: data.amount,
          balanceAfter,
          description: data.description,
          createdBy: data.createdBy,
        },
      });
    });
  },
};
