import prisma from "@/lib/prisma";
import { Prisma } from "@src/generated/prisma/client";

export const stockistHeadConfirmationRepository = {
  findByCompanyAndDate: (companyId: string, date: Date) =>
    prisma.stockistHeadConfirmation.findMany({
      where: { companyId, date },
      include: { companyStockItem: true },
    }),

  upsert: (entry: {
    companyId: string;
    companyStockItemId: string;
    date: Date;
    confirmedQuantity: number;
    confirmedIdrValue: number;
    note?: string | null;
    confirmedBy?: string | null;
  }) =>
    prisma.stockistHeadConfirmation.upsert({
      where: {
        companyId_companyStockItemId_date: {
          companyId: entry.companyId,
          companyStockItemId: entry.companyStockItemId,
          date: entry.date,
        },
      },
      update: {
        confirmedQuantity: new Prisma.Decimal(entry.confirmedQuantity),
        confirmedIdrValue: new Prisma.Decimal(entry.confirmedIdrValue),
        note: entry.note,
        confirmedBy: entry.confirmedBy,
        confirmedAt: new Date(),
      },
      create: {
        companyId: entry.companyId,
        companyStockItemId: entry.companyStockItemId,
        date: entry.date,
        confirmedQuantity: new Prisma.Decimal(entry.confirmedQuantity),
        confirmedIdrValue: new Prisma.Decimal(entry.confirmedIdrValue),
        note: entry.note,
        confirmedBy: entry.confirmedBy,
        confirmedAt: new Date(),
      },
    }),
};
