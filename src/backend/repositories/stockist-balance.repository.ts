import prisma from "@/lib/prisma";

export const stockistBalanceRepository = {
  findByPocketIds: (pocketIds: string[]) =>
    prisma.stockistBalance.findMany({
      where: { pocketId: { in: pocketIds } },
      include: { companyStockItem: true },
    }),

  // Lean variant for the grid: only the three scalar columns the matrix needs. Avoids the
  // `companyStockItem` relation (loaded as its own query on this client, and never read by the
  // grid) — one fewer round trip + far smaller payload on every grid load.
  findQuantitiesByPocketIds: (pocketIds: string[]) =>
    prisma.stockistBalance.findMany({
      where: { pocketId: { in: pocketIds } },
      select: { pocketId: true, companyStockItemId: true, quantity: true },
    }),

  findByPocketAndItem: (pocketId: string, companyStockItemId: string) =>
    prisma.stockistBalance.findUnique({
      where: { pocketId_companyStockItemId: { pocketId, companyStockItemId } },
    }),
};
