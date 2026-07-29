import prisma from "@/lib/prisma";

export type UpsertSmartdealRateInput = {
  code: string;
  name: string;
  buy: number;
  sell: number;
  // Value the row held before this write (looked up by the caller from the
  // previous findAll() result) — null on a code's first-ever write.
  prevBuy: number | null;
  prevSell: number | null;
};

export const smartdealRateRepository = {
  findAll: () => prisma.smartdealRate.findMany({ orderBy: { code: "asc" } }),

  upsertMany: (rows: UpsertSmartdealRateInput[]) =>
    prisma.$transaction(
      rows.map((r) =>
        prisma.smartdealRate.upsert({
          where: { code: r.code },
          create: {
            code: r.code,
            name: r.name,
            buy: r.buy,
            sell: r.sell,
            prevBuy: null,
            prevSell: null,
            fetchedAt: new Date(),
          },
          update: {
            name: r.name,
            buy: r.buy,
            sell: r.sell,
            prevBuy: r.prevBuy,
            prevSell: r.prevSell,
            fetchedAt: new Date(),
          },
        })
      )
    ),
};
