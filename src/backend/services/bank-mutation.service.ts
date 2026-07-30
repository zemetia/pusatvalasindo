import prisma from "@/lib/prisma";
import { NotFoundError, ValidationError } from "@/backend/errors/app-error";
import { BankMutationType } from "@src/generated/prisma/client";

export type CreateBankMutationInput = {
  bankAccountId: string;
  type: BankMutationType;
  amount: number;
  description?: string;
  createdBy?: string;
};

/**
 * Satu-satunya pintu tersisa ke BankMutation adalah tool MCP `create_bank_mutation`,
 * yang memeriksa PT rekening lebih dulu (lihat mcp/operate-tools). Route HTTP
 * `/api/bank-mutations` beserta halaman Rekening Bank → Mutasi sudah dihapus:
 * keduanya menerima `bankAccountId` mentah tanpa memeriksa PT-nya, sehingga
 * pemegang izin Rekening Bank di PT mana pun bisa membaca riwayat — dan lewat
 * POST, menggeser saldo — rekening milik PT lain.
 */
export const bankMutationService = {
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
