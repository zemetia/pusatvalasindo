import prisma from "@/lib/prisma";
import { Prisma } from "@src/generated/prisma/client";

export const stockistHeadConfirmationRepository = {
  // No relation include: both callers (getFullConfirmation / getStockConfirmationGrid and
  // recomputeCompanyTotal) only read scalar columns, so the extra join was pure overhead.
  findByCompanyAndDate: (companyId: string, date: Date) =>
    prisma.stockistHeadConfirmation.findMany({
      where: { companyId, date },
    }),

  // Hanya kuantitas per item. Nilai IDR-nya diisi sekali sebagai total final di
  // StockistTotalHeadConfirmation, jadi tidak ikut di-upsert di sini.
  upsert: (entry: {
    companyId: string;
    companyStockItemId: string;
    date: Date;
    confirmedQuantity: number;
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
        note: entry.note,
        confirmedBy: entry.confirmedBy,
        confirmedAt: new Date(),
      },
      create: {
        companyId: entry.companyId,
        companyStockItemId: entry.companyStockItemId,
        date: entry.date,
        confirmedQuantity: new Prisma.Decimal(entry.confirmedQuantity),
        note: entry.note,
        confirmedBy: entry.confirmedBy,
        confirmedAt: new Date(),
      },
    }),
};
