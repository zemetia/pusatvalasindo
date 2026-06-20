import prisma from "@/lib/prisma";

export type CreateBranchInput = {
  name: string;
  address?: string;
  phone?: string;
  companyId?: string | null;
};

export type UpdateBranchInput = Partial<CreateBranchInput & { isActive: boolean }>;

export const branchRepository = {
  findAll: (onlyActive = false) =>
    prisma.branch.findMany({
      where: onlyActive ? { isActive: true } : undefined,
      orderBy: { name: "asc" },
    }),

  findById: (id: string) =>
    prisma.branch.findUnique({ where: { id } }),

  create: (data: CreateBranchInput) =>
    prisma.branch.create({ data }),

  update: (id: string, data: UpdateBranchInput) =>
    prisma.branch.update({ where: { id }, data }),

  delete: async (id: string): Promise<void> => {
    await prisma.branch.delete({ where: { id } });
  },
};
