import prisma from "@/lib/prisma";

export type UpsertSmartdealRateInput = {
  code: string;
  name: string;
  buy: number;
  sell: number;
  // Kurs dari terbitan SmartDeal sebelumnya, sudah diputuskan oleh pemanggil
  // (smartdeal-rate.service): digeser hanya saat jam perubahan SmartDeal —
  // bukan jam scrape kita — bergerak. Null pada penulisan pertama sebuah kode.
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

const STATUS_SINGLETON_ID = "singleton";

export const smartdealScrapeStatusRepository = {
  find: () => prisma.smartdealScrapeStatus.findUnique({ where: { id: STATUS_SINGLETON_ID } }),

  recordSuccess: (sourceUpdatedAt: Date | null) => {
    const now = new Date();
    return prisma.smartdealScrapeStatus.upsert({
      where: { id: STATUS_SINGLETON_ID },
      create: {
        id: STATUS_SINGLETON_ID,
        sourceUpdatedAt,
        lastAttemptAt: now,
        lastSuccessAt: now,
        lastError: null,
      },
      update: {
        sourceUpdatedAt,
        lastAttemptAt: now,
        lastSuccessAt: now,
        lastError: null,
      },
    });
  },

  recordFailure: (message: string) => {
    const now = new Date();
    return prisma.smartdealScrapeStatus.upsert({
      where: { id: STATUS_SINGLETON_ID },
      create: { id: STATUS_SINGLETON_ID, lastAttemptAt: now, lastError: message },
      update: { lastAttemptAt: now, lastError: message },
    });
  },
};
