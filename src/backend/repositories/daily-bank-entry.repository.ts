import prisma from '@/lib/prisma'
import { Prisma } from '@src/generated/prisma/client'

export const dailyBankEntryRepository = {
  findByCompanyAndDate(companyId: string, date: Date) {
    return prisma.dailyBankEntry.findMany({
      where: {
        bankAccount: { companyId },
        date,
      },
      include: { bankAccount: true },
      orderBy: [{ bankAccount: { sortOrder: 'asc' } }],
    })
  },

  // Most recent entry strictly before `date`, per bank account — used as the
  // "saldo kemarin" reference for the live delta in Bank Harian. One query via
  // Postgres DISTINCT ON instead of N+1 per account.
  findLatestBeforeDate(companyId: string, date: Date) {
    return prisma.dailyBankEntry.findMany({
      where: {
        bankAccount: { companyId },
        date: { lt: date },
      },
      orderBy: [{ bankAccountId: 'asc' }, { date: 'desc' }],
      distinct: ['bankAccountId'],
    })
  },

  upsertMany(
    entries: {
      bankAccountId: string
      date: Date
      balance: number
      note?: string | null
      createdBy?: string | null
    }[]
  ) {
    return prisma.$transaction(
      entries.map((e) =>
        prisma.dailyBankEntry.upsert({
          where: { bankAccountId_date: { bankAccountId: e.bankAccountId, date: e.date } },
          update: {
            balance: new Prisma.Decimal(e.balance),
            note: e.note,
          },
          create: {
            bankAccountId: e.bankAccountId,
            date: e.date,
            balance: new Prisma.Decimal(e.balance),
            note: e.note,
            createdBy: e.createdBy,
          },
        })
      ),
      { timeout: 15000 }
    )
  },
}
