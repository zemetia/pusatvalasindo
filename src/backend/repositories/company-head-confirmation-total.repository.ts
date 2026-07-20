import prisma from "@/lib/prisma";
import { Prisma } from "@src/generated/prisma/client";

export const companyHeadConfirmationTotalRepository = {
  findByCompanyAndDate: (companyId: string, date: Date) =>
    prisma.companyHeadConfirmationTotal.findUnique({
      where: { companyId_date: { companyId, date } },
    }),

  upsert: (entry: { companyId: string; date: Date; totalIdr: number }) =>
    prisma.companyHeadConfirmationTotal.upsert({
      where: { companyId_date: { companyId: entry.companyId, date: entry.date } },
      update: { totalIdr: new Prisma.Decimal(entry.totalIdr) },
      create: {
        companyId: entry.companyId,
        date: entry.date,
        totalIdr: new Prisma.Decimal(entry.totalIdr),
      },
    }),
};
