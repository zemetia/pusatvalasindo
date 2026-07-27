import prisma from "@/lib/prisma";
import { Prisma } from "@src/generated/prisma/client";

// Total IDR final seluruh stock (valas + logam mulia) per PT per tanggal — satu baris,
// bukan per item. Bentuknya sengaja sama persis dengan kasHeadConfirmationRepository.
export const stockistTotalHeadConfirmationRepository = {
  findByCompanyAndDate: (companyId: string, date: Date) =>
    prisma.stockistTotalHeadConfirmation.findUnique({
      where: { companyId_date: { companyId, date } },
    }),

  upsert: (entry: {
    companyId: string;
    date: Date;
    confirmedIdrValue: number;
    note?: string | null;
    confirmedBy?: string | null;
  }) =>
    prisma.stockistTotalHeadConfirmation.upsert({
      where: { companyId_date: { companyId: entry.companyId, date: entry.date } },
      update: {
        confirmedIdrValue: new Prisma.Decimal(entry.confirmedIdrValue),
        note: entry.note,
        confirmedBy: entry.confirmedBy,
        confirmedAt: new Date(),
      },
      create: {
        companyId: entry.companyId,
        date: entry.date,
        confirmedIdrValue: new Prisma.Decimal(entry.confirmedIdrValue),
        note: entry.note,
        confirmedBy: entry.confirmedBy,
        confirmedAt: new Date(),
      },
    }),
};
