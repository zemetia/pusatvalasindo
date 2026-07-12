import {
  bankAccountRepository,
  CreateBankAccountInput,
  UpdateBankAccountInput,
} from "@/backend/repositories/bank-account.repository";
import { ConflictError, NotFoundError } from "@/backend/errors/app-error";

export const bankAccountService = {
  getAll: (companyId?: string, onlyActive = false) =>
    bankAccountRepository.findAll(companyId, onlyActive),

  getById: async (id: string) => {
    const account = await bankAccountRepository.findById(id);
    if (!account) throw new NotFoundError("Bank account not found");
    return account;
  },

  create: (data: CreateBankAccountInput) => bankAccountRepository.create(data),

  update: async (id: string, data: UpdateBankAccountInput) => {
    const account = await bankAccountRepository.findById(id);
    if (!account) throw new NotFoundError("Bank account not found");
    return bankAccountRepository.update(id, data);
  },

  deactivate: async (id: string) => {
    const account = await bankAccountRepository.findById(id);
    if (!account) throw new NotFoundError("Bank account not found");
    return bankAccountRepository.softDelete(id);
  },

  delete: async (id: string) => {
    const account = await bankAccountRepository.findById(id);
    if (!account) throw new NotFoundError("Bank account not found");
    const related = await bankAccountRepository.countRelated(id);
    if (related > 0) {
      throw new ConflictError("Rekening tidak dapat dihapus karena masih memiliki riwayat mutasi atau data stok harian");
    }
    return bankAccountRepository.hardDelete(id);
  },
};
