import prisma from "@/lib/prisma";

export const kasPocketRepository = {
  findAllByCompany: (companyId: string, onlyActive = false) =>
    prisma.kasPocket.findMany({
      where: { companyId, ...(onlyActive ? { isActive: true } : {}) },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),

  findById: (id: string) => prisma.kasPocket.findUnique({ where: { id } }),

  create: (data: { companyId: string; name: string; code?: string | null; sortOrder?: number }) =>
    prisma.kasPocket.create({ data }),

  update: (
    id: string,
    data: { name?: string; code?: string | null; sortOrder?: number; isActive?: boolean }
  ) => prisma.kasPocket.update({ where: { id }, data }),
};
