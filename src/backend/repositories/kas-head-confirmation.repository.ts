import prisma from "@/lib/prisma";
import { Prisma } from "@src/generated/prisma/client";

export const kasHeadConfirmationRepository = {
  findByCompanyAndDate: (companyId: string, date: Date) =>
    prisma.kasHeadConfirmation.findUnique({
      where: { companyId_date: { companyId, date } },
    }),

  upsert: (entry: {
    companyId: string;
    date: Date;
    confirmedIdrValue: number;
    note?: string | null;
    confirmedBy?: string | null;
  }) =>
    prisma.kasHeadConfirmation.upsert({
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

  /** Jam klop — lihat `reconcileMatch` di stockist-head-confirmation.service. */
  setMatchedAt: (id: string, matchedAt: Date | null) =>
    prisma.kasHeadConfirmation.update({ where: { id }, data: { matchedAt } }),
};
