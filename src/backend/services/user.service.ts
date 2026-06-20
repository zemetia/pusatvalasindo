import { userRepository, UpdateUserInput } from "@/backend/repositories/user.repository";
import { NotFoundError } from "@/backend/errors/app-error";

export const userService = {
  getAll: (onlyActive = false) => userRepository.findAll(onlyActive),

  getByBranch: (branchId: string, onlyActive = false) =>
    userRepository.findByBranch(branchId, onlyActive),

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
