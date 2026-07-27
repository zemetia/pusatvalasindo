import prisma from "@/lib/prisma";
import { Prisma } from "@src/generated/prisma/client";
import type { DailyVerifyStatus } from "@src/generated/prisma/client";

export const kasDailyEntryRepository = {
  // Callers key by kasPocketId and read only scalars — drop the `include: { kasPocket: true }`
  // (loaded as a separate query on this client) and the relation orderBy. One lean query.
  findByCompanyAndDate: (companyId: string, date: Date) =>
    prisma.kasDailyEntry.findMany({
      where: { kasPocket: { companyId }, date },
      select: {
        kasPocketId: true,
        balance: true,
        note: true,
        verifyStatus: true,
        verifyNote: true,
        verifiedAt: true,
      },
    }),

  findByPocketAndDate: (kasPocketId: string, date: Date) =>
    prisma.kasDailyEntry.findUnique({ where: { kasPocketId_date: { kasPocketId, date } } }),

  markVerified: (
    id: string,
    data: { verifyStatus: DailyVerifyStatus; verifyNote?: string | null; verifiedBy?: string | null }
  ) =>
    prisma.kasDailyEntry.update({
      where: { id },
      data: { ...data, verifiedAt: new Date() },
    }),

  // Dipakai saat pengajuan koreksi disetujui — saldo tanggal itu diganti angka usulan.
  applyApprovedCorrection: (id: string, balance: number, verifyNote?: string | null) =>
    prisma.kasDailyEntry.update({
      where: { id },
      data: {
        balance: new Prisma.Decimal(balance),
        verifyStatus: "BENAR",
        verifyNote,
        verifiedAt: new Date(),
      },
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
