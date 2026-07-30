import { currencyPriceRepository } from "@/backend/repositories/currency-price.repository";
import { currencyRepository } from "@/backend/repositories/currency.repository";
import { NotFoundError, ValidationError } from "@/backend/errors/app-error";
import type { PriceSource } from "@src/generated/prisma/client";

/**
 * Satu baris di halaman Harga Valas: mata uang dari master Mata Uang, plus
 * harga beli/jual kita bila sudah pernah diisi. `null` berarti belum ada harga
 * — bukan nol, supaya UI bisa membedakan "belum diisi" dari "harga 0".
 */
export interface CurrencyPriceRow {
  currencyId: string;
  code: string;
  name: string;
  symbol: string | null;
  isActive: boolean;
  buyPrice: number | null;
  sellPrice: number | null;
  /** sellPrice - buyPrice, margin yang kita ambil. Null bila harga belum lengkap. */
  spread: number | null;
  /** Asal angka yang sedang tampil. Null saat harga belum pernah diisi. */
  source: PriceSource | null;
  /** Baris terkunci dilewati setiap kali sync jalan. */
  isLocked: boolean;
  lastSyncedAt: string | null;
  note: string | null;
  updatedAt: string | null;
}

type CurrencyLike = {
  id: string;
  code: string;
  name: string;
  symbol: string | null;
  isActive: boolean;
};

type PriceLike = {
  buyPrice: { toString(): string };
  sellPrice: { toString(): string };
  source: PriceSource;
  isLocked: boolean;
  lastSyncedAt: Date | null;
  note: string | null;
  updatedAt: Date;
};

export function toCurrencyPriceRow(
  currency: CurrencyLike & { price: PriceLike | null }
): CurrencyPriceRow {
  const buyPrice = currency.price ? Number(currency.price.buyPrice.toString()) : null;
  const sellPrice = currency.price ? Number(currency.price.sellPrice.toString()) : null;

  return {
    currencyId: currency.id,
    code: currency.code,
    name: currency.name,
    symbol: currency.symbol,
    isActive: currency.isActive,
    buyPrice,
    sellPrice,
    // Dibulatkan ke 4 desimal supaya sisa floating point (mis. 0.30000000000000004)
    // tidak bocor ke layar.
    spread:
      buyPrice != null && sellPrice != null
        ? Math.round((sellPrice - buyPrice) * 1e4) / 1e4
        : null,
    source: currency.price?.source ?? null,
    isLocked: currency.price?.isLocked ?? false,
    lastSyncedAt: currency.price?.lastSyncedAt?.toISOString() ?? null,
    note: currency.price?.note ?? null,
    updatedAt: currency.price?.updatedAt.toISOString() ?? null,
  };
}

/**
 * Aturan harga yang berlaku di mana pun angka masuk — manual maupun sync.
 * Melempar `ValidationError` dengan pesan siap tampil.
 */
export function assertValidPricePair(buyPrice: number, sellPrice: number) {
  if (!Number.isFinite(buyPrice) || !Number.isFinite(sellPrice)) {
    throw new ValidationError("Harga beli dan jual harus berupa angka");
  }
  if (buyPrice < 0 || sellPrice < 0) {
    throw new ValidationError("Harga tidak boleh negatif");
  }
  // Jual di bawah beli berarti rugi di setiap transaksi — hampir pasti salah
  // ketik, jadi ditolak di sini alih-alih diam-diam tersimpan.
  if (sellPrice < buyPrice) {
    throw new ValidationError("Harga jual tidak boleh lebih rendah dari harga beli");
  }
}

export const currencyPriceService = {
  getAll: async (onlyActive = false): Promise<CurrencyPriceRow[]> => {
    const currencies = await currencyPriceRepository.findAllWithCurrency(onlyActive);
    return currencies.map(toCurrencyPriceRow);
  },

  save: async (input: {
    currencyId: string;
    buyPrice: number;
    sellPrice: number;
    note?: string | null;
    updatedBy?: string | null;
  }): Promise<CurrencyPriceRow> => {
    const currency = await currencyRepository.findById(input.currencyId);
    if (!currency) throw new NotFoundError("Mata uang tidak ditemukan");

    assertValidPricePair(input.buyPrice, input.sellPrice);

    const price = await currencyPriceRepository.upsert({
      currencyId: input.currencyId,
      buyPrice: input.buyPrice,
      sellPrice: input.sellPrice,
      // Edit manual menandai barisnya MANUAL, tapi TIDAK menguncinya — sync
      // berikutnya tetap akan menimpanya sampai orangnya menekan gembok.
      source: "MANUAL",
      note: input.note ?? null,
      updatedBy: input.updatedBy ?? null,
    });

    // Dirakit dari hasil upsert, bukan dibaca ulang — satu round-trip DB lebih
    // sedikit per baris yang disimpan.
    return toCurrencyPriceRow({ ...currency, price });
  },

  setLock: async (
    currencyId: string,
    isLocked: boolean,
    updatedBy: string | null
  ): Promise<CurrencyPriceRow> => {
    const currency = await currencyRepository.findById(currencyId);
    if (!currency) throw new NotFoundError("Mata uang tidak ditemukan");

    // Gembok hidup di baris harga, jadi tidak ada yang bisa dikunci sebelum
    // harganya ada. UI menonaktifkan tombolnya, ini jaring pengaman kedua.
    const existing = await currencyPriceRepository.findByCurrencyId(currencyId);
    if (!existing) {
      throw new ValidationError("Isi harganya dulu sebelum dikunci");
    }

    const price = await currencyPriceRepository.setLock(currencyId, isLocked, updatedBy);
    return toCurrencyPriceRow({ ...currency, price });
  },

  /** Mengosongkan harga sebuah mata uang (kembali ke keadaan "belum diisi"). */
  clear: async (currencyId: string): Promise<void> => {
    await currencyPriceRepository.deleteByCurrencyId(currencyId);
  },
};
