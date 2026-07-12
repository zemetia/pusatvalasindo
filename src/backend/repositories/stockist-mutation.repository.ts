import prisma from "@/lib/prisma";

export type StockistMutationFilters = {
  companyId?: string;
  pocketId?: string;
  companyStockItemId?: string;
  from?: Date;
  to?: Date;
};

export const stockistMutationRepository = {
  findPage: (filters: StockistMutationFilters = {}, take = 50, cursor?: string) =>
    prisma.stockistMutation.findMany({
      where: {
        ...(filters.pocketId ? { pocketId: filters.pocketId } : {}),
        ...(filters.companyStockItemId ? { companyStockItemId: filters.companyStockItemId } : {}),
        ...(filters.companyId ? { pocket: { companyId: filters.companyId } } : {}),
        ...(filters.from || filters.to
          ? {
              createdAt: {
                ...(filters.from ? { gte: filters.from } : {}),
                ...(filters.to ? { lte: filters.to } : {}),
              },
            }
          : {}),
      },
      include: { pocket: true, companyStockItem: true },
      orderBy: { createdAt: "desc" },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    }),
};
