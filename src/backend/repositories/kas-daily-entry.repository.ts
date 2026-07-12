import prisma from "@/lib/prisma";
import { Prisma } from "@src/generated/prisma/client";

export const kasDailyEntryRepository = {
  findByCompanyAndDate: (companyId: string, date: Date) =>
    prisma.kasDailyEntry.findMany({
      where: { kasPocket: { companyId }, date },
      include: { kasPocket: true },
      orderBy: [{ kasPocket: { sortOrder: "asc" } }],
    }),

  // Most recent entry strictly before `date`, per kas pocket — "saldo kemarin" reference for the live delta.
  findLatestBeforeDate: (companyId: string, date: Date) =>
    prisma.kasDailyEntry.findMany({
      where: { kasPocket: { companyId }, date: { lt: date } },
      orderBy: [{ kasPocketId: "asc" }, { date: "desc" }],
      distinct: ["kasPocketId"],
    }),

  upsert: (entry: {
    kasPocketId: string;
    date: Date;
    balance: number;
    note?: string | null;
    createdBy?: string | null;
  }) =>
    prisma.kasDailyEntry.upsert({
      where: { kasPocketId_date: { kasPocketId: entry.kasPocketId, date: entry.date } },
      update: {
        balance: new Prisma.Decimal(entry.balance),
        note: entry.note,
      },
      create: {
        kasPocketId: entry.kasPocketId,
        date: entry.date,
        balance: new Prisma.Decimal(entry.balance),
        note: entry.note,
        createdBy: entry.createdBy,
      },
    }),
};
