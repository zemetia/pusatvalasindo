import prisma from '@/lib/prisma'
import { Prisma } from '@src/generated/prisma/client'
import type { DailyVerifyStatus } from '@src/generated/prisma/client'

export const dailyBankEntryRepository = {
  // Callers key the result by bankAccountId (a lookup map) and only read the scalar columns,
  // so we select just those — no `include: { bankAccount: true }` (that relation is loaded as a
  // separate query on this client) and no relation-based orderBy (a JOIN whose order is discarded
  // by the map). Trims a full round trip + payload per Bank Harian load.
  findByCompanyAndDate(companyId: string, date: Date) {
    return prisma.dailyBankEntry.findMany({
      where: {
        bankAccount: { companyId },
        date,
      },
      select: {
        bankAccountId: true,
        balance: true,
        note: true,
        verifyStatus: true,
        verifyNote: true,
        verifiedAt: true,
      },
    })
  },

  findByAccountAndDate(bankAccountId: string, date: Date) {
    return prisma.dailyBankEntry.findUnique({ where: { bankAccountId_date: { bankAccountId, date } } })
  },

  markVerified(
    id: string,
    data: { verifyStatus: DailyVerifyStatus; verifyNote?: string | null; verifiedBy?: string | null }
  ) {
    return prisma.dailyBankEntry.update({ where: { id }, data: { ...data, verifiedAt: new Date() } })
  },

  // Dipakai saat pengajuan koreksi disetujui — saldo tanggal itu diganti angka usulan.
  applyApprovedCorrection(id: string, balance: number, verifyNote?: string | null) {
    return prisma.dailyBankEntry.update({
      where: { id },
      data: {
        balance: new Prisma.Decimal(balance),
        verifyStatus: 'BENAR',
        verifyNote,
        verifiedAt: new Date(),
      },
    })
  },

  // Total saldo bank "menurut sistem" untuk cross-check kepala cabang: jumlah saldo harian
  // seluruh rekening aktif PT pada tanggal itu. Diagregasi di DB supaya yang lewat kabel cuma
  // satu angka, bukan seluruh baris entry.
  async sumActiveByCompanyAndDate(companyId: string, date: Date) {
    const result = await prisma.dailyBankEntry.aggregate({
      where: { bankAccount: { companyId, isActive: true }, date },
      _sum: { balance: true },
    })
    return Number(result._sum.balance ?? 0)
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

  // Satu baris saja — dipakai alur verifikasi H+1 untuk membuat entri saldo 0 pada
  // rekening yang tanggal itu tidak diisi, supaya hasil konfirmasinya punya tempat menempel.
  upsertOne(entry: {
    bankAccountId: string
    date: Date
    balance: number
    note?: string | null
    createdBy?: string | null
  }) {
    return prisma.dailyBankEntry.upsert({
      where: { bankAccountId_date: { bankAccountId: entry.bankAccountId, date: entry.date } },
      update: {
        balance: new Prisma.Decimal(entry.balance),
        note: entry.note,
      },
      create: {
        bankAccountId: entry.bankAccountId,
        date: entry.date,
        balance: new Prisma.Decimal(entry.balance),
        note: entry.note,
        createdBy: entry.createdBy,
      },
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
