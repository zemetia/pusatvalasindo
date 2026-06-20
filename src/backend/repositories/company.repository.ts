import prisma from "@/lib/prisma";

export type CreateCompanyInput = {
  name: string;
  code: string;
};

export type UpdateCompanyInput = {
  name?: string;
  code?: string;
  isActive?: boolean;
};

const select = {
  id: true,
  name: true,
  code: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

export const companyRepository = {
  findAll: () =>
    prisma.company.findMany({
      select,
      orderBy: { name: "asc" },
    }),

  findById: (id: string) =>
    prisma.company.findUnique({ where: { id }, select }),

  findByCode: (code: string) =>
    prisma.company.findUnique({ where: { code }, select }),

  create: (data: CreateCompanyInput) =>
    prisma.company.create({ data, select }),

  update: (id: string, data: UpdateCompanyInput) =>
    prisma.company.update({ where: { id }, data, select }),

  delete: async (id: string): Promise<void> => {
    await prisma.company.delete({ where: { id } });
  },
};
