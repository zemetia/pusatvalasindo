import prisma from "@/lib/prisma";
import type { StockistCheckStatus } from "@src/generated/prisma/client";

export const stockistDailyCheckRepository = {
  findByPocketsAndDate: (pocketIds: string[], date: Date) =>
    prisma.stockistDailyCheck.findMany({
      where: { pocketId: { in: pocketIds }, date },
    }),

  // Same set of rows as findByPocketsAndDate over a company's real (non-default, active) pockets,
  // but resolved via a pocket relation-filter so callers don't need to fetch the pocket list first
  // (removes a query waterfall). Only the columns needed to sum the system total are selected.
  findByCompanyAndDate: (companyId: string, date: Date) =>
    prisma.stockistDailyCheck.findMany({
      where: {
        date,
        pocket: { companyId, isDefault: false, isActive: true, deletedAt: null },
      },
      select: { companyStockItemId: true, enteredQuantity: true },
    }),

  findByPocketItemDate: (pocketId: string, companyStockItemId: string, date: Date) =>
    prisma.stockistDailyCheck.findUnique({
      where: { pocketId_companyStockItemId_date: { pocketId, companyStockItemId, date } },
    }),

  findPage: (
    filters: { companyId?: string; pocketId?: string; from?: Date; to?: Date; status?: StockistCheckStatus },
    take = 50,
    cursor?: string
  ) =>
    prisma.stockistDailyCheck.findMany({
      where: {
        ...(filters.pocketId ? { pocketId: filters.pocketId } : {}),
        ...(filters.companyId ? { pocket: { companyId: filters.companyId } } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.from || filters.to
          ? {
              date: {
                ...(filters.from ? { gte: filters.from } : {}),
                ...(filters.to ? { lte: filters.to } : {}),
              },
            }
          : {}),
      },
      include: { pocket: true, companyStockItem: true },
      orderBy: { date: "desc" },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    }),
};
