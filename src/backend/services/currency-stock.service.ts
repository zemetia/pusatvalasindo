import { currencyStockRepository } from "@/backend/repositories/currency-stock.repository";
import { NotFoundError } from "@/backend/errors/app-error";

export const currencyStockService = {
  getAll: (branchId?: string, currencyId?: string) =>
    currencyStockRepository.findAll(branchId, currencyId),

  getById: async (id: string) => {
    const stock = await currencyStockRepository.findById(id);
    if (!stock) throw new NotFoundError("Currency stock not found");
    return stock;
  },

  updateRates: async (id: string, buyRate?: number, sellRate?: number) => {
    const stock = await currencyStockRepository.findById(id);
    if (!stock) throw new NotFoundError("Currency stock not found");
    return currencyStockRepository.updateRates(id, buyRate, sellRate);
  },
};
