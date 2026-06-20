import prisma from "@/lib/prisma";

export type CreateKpiLogInput = {
  employeeId: string;
  kpiId: string;
  value: number;
  note?: string;
};

const select = {
  id: true,
  employeeId: true,
  kpiId: true,
  value: true,
  note: true,
  createdAt: true,
  definition: { select: { id: true, name: true, type: true } },
};

export const kpiLogRepository = {
  findByEmployee: (employeeId: string) =>
    prisma.kpiLog.findMany({
      where: { employeeId },
      select,
      orderBy: { createdAt: "desc" },
    }),

  findByEmployeePeriod: (employeeId: string, month: number, year: number) => {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);
    return prisma.kpiLog.findMany({
      where: { employeeId, createdAt: { gte: startDate, lt: endDate } },
      select,
      orderBy: { createdAt: "desc" },
    });
  },

  create: (data: CreateKpiLogInput) =>
    prisma.kpiLog.create({ data, select }),

  delete: async (id: string): Promise<void> => {
    await prisma.kpiLog.delete({ where: { id } });
  },
};
