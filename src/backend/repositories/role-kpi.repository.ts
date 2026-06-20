import prisma from "@/lib/prisma";

export type CreateRoleKpiInput = {
  companyId: string;
  customRoleId?: string | null;
  kpiId: string;
  maxScore: number;
  targetValue?: number;
  threshold?: number;
  weight: number;
};

export type UpdateRoleKpiInput = {
  maxScore?: number;
  targetValue?: number | null;
  threshold?: number | null;
  weight?: number;
};

const select = {
  id: true,
  companyId: true,
  customRoleId: true,
  kpiId: true,
  maxScore: true,
  targetValue: true,
  threshold: true,
  weight: true,
  createdAt: true,
  updatedAt: true,
  definition: { select: { id: true, name: true, type: true } },
  company: { select: { id: true, name: true, code: true } },
  customRole: { select: { id: true, name: true } },
};

export const roleKpiRepository = {
  findAll: () =>
    prisma.roleKpi.findMany({
      select,
      orderBy: [{ company: { name: "asc" } }, { definition: { name: "asc" } }],
    }),

  findByCompanyRole: (companyId: string, customRoleId?: string) =>
    prisma.roleKpi.findMany({
      where: { companyId, customRoleId },
      select,
      orderBy: { definition: { name: "asc" } },
    }),

  findById: (id: string) =>
    prisma.roleKpi.findUnique({ where: { id }, select }),

  create: (data: CreateRoleKpiInput) =>
    prisma.roleKpi.create({ data, select }),

  update: (id: string, data: UpdateRoleKpiInput) =>
    prisma.roleKpi.update({ where: { id }, data, select }),

  delete: async (id: string): Promise<void> => {
    await prisma.roleKpi.delete({ where: { id } });
  },
};
