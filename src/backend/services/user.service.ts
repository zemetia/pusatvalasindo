import type { UpdateUserInput } from "@/backend/repositories/user.repository";
import { userRepository } from "@/backend/repositories/user.repository";
import { NotFoundError } from "@/backend/errors/app-error";

export const userService = {
  getAll: (onlyActive = false) => userRepository.findAll(onlyActive),

  /** Daftar pengguna sesuai scope PT si pemanggil (null = seluruh PT). */
  getScoped: (opts: { companyIds: string[] | null; branchId?: string | null; onlyActive?: boolean }) =>
    userRepository.findScoped(opts),

  /** PT pemilik pengguna (lewat cabangnya) — gerbang untuk setiap mutasi. */
  getCompanyOf: async (id: string) => {
    const row = await userRepository.findCompanyOf(id);
    if (!row) throw new NotFoundError("Pengguna tidak ditemukan");
    return row.branch?.companyId ?? null;
  },

  getByBranch: (branchId: string, onlyActive = false) =>
    userRepository.findByBranch(branchId, onlyActive),

  getByCompany: (companyId: string, onlyActive = false) =>
    userRepository.findByCompany(companyId, onlyActive),

  getById: async (id: string) => {
    const user = await userRepository.findById(id);
    if (!user) throw new NotFoundError("User not found");
    return user;
  },

  update: async (id: string, data: UpdateUserInput) => {
    const user = await userRepository.findById(id);
    if (!user) throw new NotFoundError("User not found");
    return userRepository.update(id, data);
  },

  delete: async (id: string) => {
    const user = await userRepository.findById(id);
    if (!user) throw new NotFoundError("User not found");
    await userRepository.delete(id);
  },
};
