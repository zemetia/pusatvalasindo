import {
  currencyRepository,
  CreateCurrencyInput,
  UpdateCurrencyInput,
} from "@/backend/repositories/currency.repository";
import { NotFoundError, ConflictError } from "@/backend/errors/app-error";

export const currencyService = {
  getAll: (onlyActive = false) => currencyRepository.findAll(onlyActive),

  getById: async (id: string) => {
    const currency = await currencyRepository.findById(id);
    if (!currency) throw new NotFoundError("Currency not found");
    return currency;
  },

  create: async (data: CreateCurrencyInput) => {
    const existing = await currencyRepository.findByCode(data.code);
    if (existing) throw new ConflictError(`Currency code ${data.code.toUpperCase()} already exists`);
    return currencyRepository.create(data);
  },

  update: async (id: string, data: UpdateCurrencyInput) => {
    const currency = await currencyRepository.findById(id);
    if (!currency) throw new NotFoundError("Currency not found");
    return currencyRepository.update(id, data);
  },

  delete: async (id: string) => {
    const currency = await currencyRepository.findById(id);
    if (!currency) throw new NotFoundError("Currency not found");
    await currencyRepository.delete(id);
  },
};
