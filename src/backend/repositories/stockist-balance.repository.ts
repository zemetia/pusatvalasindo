import prisma from "@/lib/prisma";

export const stockistBalanceRepository = {
  findByPocketIds: (pocketIds: string[]) =>
    prisma.stockistBalance.findMany({
      where: { pocketId: { in: pocketIds } },
      include: { companyStockItem: true },
    }),

  findByPocketAndItem: (pocketId: string, companyStockItemId: string) =>
    prisma.stockistBalance.findUnique({
      where: { pocketId_companyStockItemId: { pocketId, companyStockItemId } },
    }),
};
