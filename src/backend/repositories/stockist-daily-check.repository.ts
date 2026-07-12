import prisma from "@/lib/prisma";
import type { StockistCheckStatus } from "@src/generated/prisma/client";

export const stockistDailyCheckRepository = {
  findByPocketsAndDate: (pocketIds: string[], date: Date) =>
    prisma.stockistDailyCheck.findMany({
      where: { pocketId: { in: pocketIds }, date },
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
