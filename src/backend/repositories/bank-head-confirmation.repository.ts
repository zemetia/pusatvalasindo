import prisma from "@/lib/prisma";
import { Prisma } from "@src/generated/prisma/client";

// Konfirmasi total saldo bank (gabungan semua rekening PT) oleh kepala cabang.
export const bankHeadConfirmationRepository = {
  findByCompanyAndDate: (companyId: string, date: Date) =>
    prisma.bankHeadConfirmation.findUnique({
      where: { companyId_date: { companyId, date } },
    }),

  upsert: (entry: {
    companyId: string;
    date: Date;
    confirmedIdrValue: number;
    note?: string | null;
    confirmedBy?: string | null;
  }) =>
    prisma.bankHeadConfirmation.upsert({
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
