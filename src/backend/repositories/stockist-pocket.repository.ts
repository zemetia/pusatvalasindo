import prisma from "@/lib/prisma";

export const stockistPocketRepository = {
  findAllByCompany: (companyId: string, onlyActive = false) =>
    prisma.stockistPocket.findMany({
      where: { companyId, ...(onlyActive ? { isActive: true } : {}) },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),

  findById: (id: string) => prisma.stockistPocket.findUnique({ where: { id } }),

  create: (data: { companyId: string; name: string; code?: string | null; sortOrder?: number }) =>
    prisma.stockistPocket.create({ data }),

  update: (
    id: string,
    data: { name?: string; code?: string | null; sortOrder?: number; isActive?: boolean }
  ) => prisma.stockistPocket.update({ where: { id }, data }),
};
