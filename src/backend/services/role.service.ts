import {
  roleRepository,
  CreateRoleInput,
  UpdateRoleInput,
} from "@/backend/repositories/role.repository";
import { NotFoundError } from "@/backend/errors/app-error";

export const roleService = {
  getAll: () => roleRepository.findAll(),

  getByCompany: (companyId: string | null) => roleRepository.findByCompanyId(companyId),

  getById: async (id: string) => {
    const role = await roleRepository.findById(id);
    if (!role) throw new NotFoundError("Role not found");
    return role;
  },

  create: (data: CreateRoleInput) => roleRepository.create(data),

  update: async (id: string, data: UpdateRoleInput) => {
    const role = await roleRepository.findById(id);
    if (!role) throw new NotFoundError("Role not found");
    return roleRepository.update(id, data);
  },

  delete: async (id: string) => {
    const role = await roleRepository.findById(id);
    if (!role) throw new NotFoundError("Role not found");
    await roleRepository.delete(id);
  },
};
