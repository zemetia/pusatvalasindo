import prisma from "@/lib/prisma";

export type UpsertPriceBenchmarkInput = {
  code: string;
  name: string;
  sellAdjustment: string;
  buyAdjustment: string;
  updatedBy?: string | null;
};

export const priceBenchmarkRepository = {
  findAll: () => prisma.priceBenchmark.findMany({ orderBy: { code: "asc" } }),

  upsert: (data: UpsertPriceBenchmarkInput) =>
    prisma.priceBenchmark.upsert({
      where: { code: data.code },
      create: data,
      update: {
        name: data.name,
        sellAdjustment: data.sellAdjustment,
        buyAdjustment: data.buyAdjustment,
        updatedBy: data.updatedBy,
      },
    }),
};
