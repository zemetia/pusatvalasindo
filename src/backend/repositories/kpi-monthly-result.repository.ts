import prisma from "@/lib/prisma";
import { BonusResultType } from "@src/generated/prisma/client";

const select = {
  id: true,
  employeeId: true,
  month: true,
  year: true,
  totalScore: true,
  bonusAmount: true,
  bonusResult: true,
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

  upsert: (data: {
    employeeId: string;
    month: number;
    year: number;
    totalScore: number;
    bonusAmount?: number;
    bonusResult?: BonusResultType;
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
        bonusAmount: data.bonusAmount,
        bonusResult: data.bonusResult,
        breakdownJson: data.breakdownJson,
        calculatedAt: new Date(),
      },
      update: {
        totalScore: data.totalScore,
        bonusAmount: data.bonusAmount,
        bonusResult: data.bonusResult,
        breakdownJson: data.breakdownJson,
        calculatedAt: new Date(),
      },
      select,
    }),
};
