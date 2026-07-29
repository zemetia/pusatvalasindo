import { smartdealRateRepository } from "@/backend/repositories/smartdeal-rate.repository";
import { fetchSmartdealRates } from "@/lib/smartdeal-scraper";

export interface SmartdealRateRow {
  code: string;
  name: string;
  buy: number;
  sell: number;
  prevBuy: number | null;
  prevSell: number | null;
  fetchedAt: string;
}

export const smartdealRateService = {
  // Called by the trigger endpoint (src/app/api/scrape/smartdeal/route.ts).
  // Scrapes smartdeal.co.id live and upserts into SmartdealRate — everything
  // else reads the DB copy instead of hitting the site directly. Reads the
  // current rows first so each upsert can carry its pre-write buy/sell into
  // prevBuy/prevSell, letting the UI flag what moved since the last fetch.
  refreshFromSource: async (): Promise<{ count: number }> => {
    const [rates, existing] = await Promise.all([
      fetchSmartdealRates(),
      smartdealRateRepository.findAll(),
    ]);
    if (rates.length === 0) throw new Error("SmartDeal returned no rates");

    const existingByCode = new Map(existing.map((r) => [r.code, r]));
    const rows = rates.map((r) => {
      const prev = existingByCode.get(r.code);
      return {
        code: r.code,
        name: r.name,
        buy: r.buy,
        sell: r.sell,
        prevBuy: prev?.buy ?? null,
        prevSell: prev?.sell ?? null,
      };
    });

    await smartdealRateRepository.upsertMany(rows);
    return { count: rows.length };
  },

  getLatest: async (): Promise<SmartdealRateRow[]> => {
    const rows = await smartdealRateRepository.findAll();
    return rows.map((r) => ({
      code: r.code,
      name: r.name,
      buy: r.buy,
      sell: r.sell,
      prevBuy: r.prevBuy,
      prevSell: r.prevSell,
      fetchedAt: r.fetchedAt.toISOString(),
    }));
  },
};
