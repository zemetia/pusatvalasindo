import {
  branchRepository,
  CreateBranchInput,
  UpdateBranchInput,
} from "@/backend/repositories/branch.repository";
import { NotFoundError } from "@/backend/errors/app-error";

export const branchService = {
  getAll: (onlyActive = false) => branchRepository.findAll(onlyActive),

  getById: async (id: string) => {
    const branch = await branchRepository.findById(id);
    if (!branch) throw new NotFoundError("Branch not found");
    return branch;
  },

  create: (data: CreateBranchInput) => branchRepository.create(data),

  update: async (id: string, data: UpdateBranchInput) => {
    const branch = await branchRepository.findById(id);
    if (!branch) throw new NotFoundError("Branch not found");
    return branchRepository.update(id, data);
  },

  delete: async (id: string) => {
    const branch = await branchRepository.findById(id);
    if (!branch) throw new NotFoundError("Branch not found");
    // Related records (stock items/stocks/mutations, users, attendances) are
    // orphaned automatically via onDelete: SetNull on their branch relation.
    await branchRepository.delete(id);
  },
};
