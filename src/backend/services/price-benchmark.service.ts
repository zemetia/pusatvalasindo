import { priceBenchmarkRepository } from "@/backend/repositories/price-benchmark.repository";
import { SMARTDEAL_CURRENCIES } from "@/lib/smartdeal-currencies";
import { isValidPriceAdjustment } from "@/lib/price-adjustment";
import { ValidationError } from "@/backend/errors/app-error";

export interface PriceBenchmarkRow {
  code: string;
  name: string;
  sellAdjustment: string;
  buyAdjustment: string;
  updatedAt: string | null;
}

export const priceBenchmarkService = {
  getAll: async (): Promise<PriceBenchmarkRow[]> => {
    const saved = await priceBenchmarkRepository.findAll();
    const savedByCode = new Map(saved.map((row) => [row.code, row]));

    // Union of the known SmartDeal list and whatever's already saved, so a
    // currency dropped from SMARTDEAL_CURRENCIES doesn't silently hide an
    // existing adjustment rule.
    const codes = new Set<string>([
      ...SMARTDEAL_CURRENCIES.map((c) => c.code),
      ...saved.map((row) => row.code),
    ]);
    const nameByCode = new Map(SMARTDEAL_CURRENCIES.map((c) => [c.code, c.name]));

    return Array.from(codes)
      .sort()
      .map((code) => {
        const row = savedByCode.get(code);
        return {
          code,
          name: row?.name ?? nameByCode.get(code) ?? code,
          sellAdjustment: row?.sellAdjustment ?? "",
          buyAdjustment: row?.buyAdjustment ?? "",
          updatedAt: row?.updatedAt.toISOString() ?? null,
        };
      });
  },

  saveAdjustment: async (input: {
    code: string;
    sellAdjustment: string;
    buyAdjustment: string;
    updatedBy?: string | null;
  }): Promise<PriceBenchmarkRow> => {
    const sellAdjustment = input.sellAdjustment.trim();
    const buyAdjustment = input.buyAdjustment.trim();
    if (!isValidPriceAdjustment(sellAdjustment)) {
      throw new ValidationError(`Format penyesuaian harga jual tidak valid: "${input.sellAdjustment}"`);
    }
    if (!isValidPriceAdjustment(buyAdjustment)) {
      throw new ValidationError(`Format penyesuaian harga beli tidak valid: "${input.buyAdjustment}"`);
    }

    const name =
      SMARTDEAL_CURRENCIES.find((c) => c.code === input.code)?.name ?? input.code;

    const row = await priceBenchmarkRepository.upsert({
      code: input.code,
      name,
      sellAdjustment,
      buyAdjustment,
      updatedBy: input.updatedBy ?? null,
    });

    return {
      code: row.code,
      name: row.name,
      sellAdjustment: row.sellAdjustment,
      buyAdjustment: row.buyAdjustment,
      updatedAt: row.updatedAt.toISOString(),
    };
  },
};
