import prisma from "@/lib/prisma";
import { stockMutationRepository, StockMutationFilters } from "@/backend/repositories/stock-mutation.repository";
import { NotFoundError, ValidationError } from "@/backend/errors/app-error";
import { StockMutationType } from "@src/generated/prisma/client";

export type CreateStockMutationInput = {
  branchId: string;
  currencyId: string;
  type: StockMutationType;
  quantity: number;
  rate?: number;
  note?: string;
  createdBy?: string;
};

const ADDITIVE_TYPES: StockMutationType[] = [
  StockMutationType.OPENING,
  StockMutationType.BUY,
  StockMutationType.TRANSFER_IN,
  StockMutationType.ADJUSTMENT,
];

export const stockMutationService = {
  getAll: (filters?: StockMutationFilters) =>
    stockMutationRepository.findAll(filters),

  getById: async (id: string) => {
    const mutation = await stockMutationRepository.findById(id);
    if (!mutation) throw new NotFoundError("Stock mutation not found");
    return mutation;
  },

  create: async (data: CreateStockMutationInput) => {
    if (data.quantity <= 0) throw new ValidationError("Quantity must be greater than 0");

    return prisma.$transaction(async (tx) => {
      const isAdditive = ADDITIVE_TYPES.includes(data.type);

      const existing = await tx.currencyStock.findUnique({
        where: { branchId_currencyId: { branchId: data.branchId, currencyId: data.currencyId } },
      });

      const currentQty = existing ? Number(existing.quantity) : 0;
      const newQty = isAdditive ? currentQty + data.quantity : currentQty - data.quantity;

      if (existing) {
        await tx.currencyStock.update({
          where: { id: existing.id },
          data: {
            quantity: newQty,
            ...(data.type === StockMutationType.BUY && data.rate ? { buyRate: data.rate } : {}),
            ...(data.type === StockMutationType.SELL && data.rate ? { sellRate: data.rate } : {}),
          },
        });
      } else {
        await tx.currencyStock.create({
          data: {
            branchId: data.branchId,
            currencyId: data.currencyId,
            quantity: newQty,
            ...(data.type === StockMutationType.BUY && data.rate ? { buyRate: data.rate } : {}),
            ...(data.type === StockMutationType.SELL && data.rate ? { sellRate: data.rate } : {}),
          },
        });
      }

      const idrValue = data.rate ? data.quantity * data.rate : undefined;

      return tx.stockMutation.create({
        data: {
          branchId: data.branchId,
          currencyId: data.currencyId,
          type: data.type,
          quantity: data.quantity,
          rate: data.rate,
          idrValue,
          note: data.note,
          createdBy: data.createdBy,
        },
        include: { branch: true, currency: true },
      });
    });
  },
};
