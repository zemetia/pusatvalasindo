import prisma from "@/lib/prisma";

export const currencyStockRepository = {
  // `companyIds` menyaring lewat cabang: null berarti seluruh PT, array kosong
  // berarti tidak satu pun — sengaja dibedakan, sejalan dengan AuthzDecision.
  findAll: (branchId?: string, currencyId?: string, companyIds?: string[] | null) =>
    prisma.currencyStock.findMany({
      where: {
        ...(branchId ? { branchId } : {}),
        ...(currencyId ? { currencyId } : {}),
        ...(companyIds === undefined || companyIds === null
          ? {}
          : { branch: { companyId: { in: companyIds } } }),
      },
      include: { branch: true, currency: true },
      orderBy: [{ branch: { name: "asc" } }, { currency: { code: "asc" } }],
    }),

  findByBranchAndCurrency: (branchId: string, currencyId: string) =>
    prisma.currencyStock.findUnique({
      where: { branchId_currencyId: { branchId, currencyId } },
      include: { branch: true, currency: true },
    }),

  findById: (id: string) =>
    prisma.currencyStock.findUnique({
      where: { id },
      include: { branch: true, currency: true },
    }),

  updateRates: (id: string, buyRate?: number, sellRate?: number) =>
    prisma.currencyStock.update({
      where: { id },
      data: {
        ...(buyRate !== undefined ? { buyRate } : {}),
        ...(sellRate !== undefined ? { sellRate } : {}),
      },
      include: { branch: true, currency: true },
    }),
};
