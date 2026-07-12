import prisma from "@/lib/prisma";

export type StockMutationFilters = {
  branchId?: string;
  currencyId?: string;
  type?: string;
  from?: Date;
  to?: Date;
};

export const stockMutationRepository = {
  findAll: (filters: StockMutationFilters = {}) =>
    prisma.stockMutation.findMany({
      where: {
        ...(filters.branchId ? { branchId: filters.branchId } : {}),
        ...(filters.currencyId ? { currencyId: filters.currencyId } : {}),
        ...(filters.type ? { type: filters.type as never } : {}),
        ...(filters.from || filters.to
          ? {
              createdAt: {
                ...(filters.from ? { gte: filters.from } : {}),
                ...(filters.to ? { lte: filters.to } : {}),
              },
            }
          : {}),
      },
      include: { branch: true, currency: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),

  findById: (id: string) =>
    prisma.stockMutation.findUnique({
      where: { id },
      include: { branch: true, currency: true },
    }),
};
