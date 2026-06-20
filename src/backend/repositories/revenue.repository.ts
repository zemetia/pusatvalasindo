import prisma from "@/lib/prisma";

export type CreateRevenueInput = {
  employeeId: string;
  amount: number;
  date?: Date;
  note?: string;
};

const select = {
  id: true,
  employeeId: true,
  amount: true,
  date: true,
  note: true,
  createdAt: true,
};

export const revenueRepository = {
  findByEmployee: (employeeId: string) =>
    prisma.revenue.findMany({
      where: { employeeId },
      select,
      orderBy: { date: "desc" },
    }),

  findByEmployeePeriod: (employeeId: string, month: number, year: number) => {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);
    return prisma.revenue.findMany({
      where: { employeeId, date: { gte: startDate, lt: endDate } },
      select,
      orderBy: { date: "desc" },
    });
  },

  create: (data: CreateRevenueInput) =>
    prisma.revenue.create({
      data: { ...data, date: data.date ?? new Date() },
      select,
    }),

  delete: async (id: string): Promise<void> => {
    await prisma.revenue.delete({ where: { id } });
  },
};
