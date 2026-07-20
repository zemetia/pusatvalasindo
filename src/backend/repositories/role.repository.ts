import prisma from "@/lib/prisma";

export type CreateRoleInput = {
  name: string;
  description?: string;
  companyId?: string | null;
  permissions: string[];
  payrollCompanyIds?: string[];
};

export type UpdateRoleInput = Partial<CreateRoleInput>;

export const roleRepository = {
  findAll: () =>
    prisma.custom_role.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { users: true },
        },
      },
    }),

  findByCompanyId: (companyId: string | null) =>
    prisma.custom_role.findMany({
      where: { companyId },
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { users: true },
        },
      },
    }),

  findById: (id: string) =>
    prisma.custom_role.findUnique({ where: { id } }),

  create: (data: CreateRoleInput) =>
    prisma.custom_role.create({ data }),

  update: (id: string, data: UpdateRoleInput) =>
    prisma.custom_role.update({ where: { id }, data }),

  delete: async (id: string): Promise<void> => {
    await prisma.custom_role.delete({ where: { id } });
  },
};
