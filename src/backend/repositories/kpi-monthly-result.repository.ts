import prisma from "@/lib/prisma";

const select = {
  id: true,
  employeeId: true,
  month: true,
  year: true,
  totalScore: true,
  grade: true,
  breakdownJson: true,
  calculatedAt: true,
};

export const kpiMonthlyResultRepository = {
  findByEmployeePeriod: (employeeId: string, month: number, year: number) =>
    prisma.kpiMonthlyResult.findUnique({
      where: { employeeId_month_year: { employeeId, month, year } },
      select,
    }),

  findByEmployee: (employeeId: string) =>
    prisma.kpiMonthlyResult.findMany({
      where: { employeeId },
      select,
      orderBy: [{ year: "desc" }, { month: "desc" }],
    }),

  /** Seluruh hasil satu periode — dipakai payroll untuk memeringkat top performer. */
  findByPeriod: (month: number, year: number, employeeIds?: string[]) =>
    prisma.kpiMonthlyResult.findMany({
      where: { month, year, ...(employeeIds ? { employeeId: { in: employeeIds } } : {}) },
      select,
      orderBy: { totalScore: "desc" },
    }),

  upsert: (data: {
    employeeId: string;
    month: number;
    year: number;
    totalScore: number;
    grade: string;
    breakdownJson: object;
  }) =>
    prisma.kpiMonthlyResult.upsert({
      where: {
        employeeId_month_year: {
          employeeId: data.employeeId,
          month: data.month,
          year: data.year,
        },
      },
      create: {
        employeeId: data.employeeId,
        month: data.month,
        year: data.year,
        totalScore: data.totalScore,
        grade: data.grade,
        breakdownJson: data.breakdownJson,
        calculatedAt: new Date(),
      },
      update: {
        totalScore: data.totalScore,
        grade: data.grade,
        breakdownJson: data.breakdownJson,
        calculatedAt: new Date(),
      },
      select,
    }),
};
