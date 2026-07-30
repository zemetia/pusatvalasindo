import prisma from "@/lib/prisma";
import type { Prisma, PriceSource } from "@src/generated/prisma/client";

export type UpsertCurrencyPriceInput = {
  currencyId: string;
  buyPrice: Prisma.Decimal | number | string;
  sellPrice: Prisma.Decimal | number | string;
  source: PriceSource;
  note?: string | null;
  updatedBy?: string | null;
  /** Diisi hanya oleh jalur sync. */
  lastSyncedAt?: Date | null;
};

export const currencyPriceRepository = {
  /**
   * Daftar mata uang beserta harga kita. Sengaja berangkat dari `currency`,
   * bukan dari `currencyPrice`, supaya mata uang yang belum pernah diisi
   * harganya tetap muncul (barisnya kosong dan siap diisi).
   */
  findAllWithCurrency: (onlyActive = false) =>
    prisma.currency.findMany({
      where: onlyActive ? { isActive: true } : undefined,
      orderBy: { code: "asc" },
      include: { price: true },
    }),

  /**
   * Mata uang untuk sekumpulan kode, beserta harganya. Dipakai jalur sync yang
   * hanya menyentuh kode yang benar-benar dikuotasi SmartDeal — jauh lebih
   * sedikit dari isi master mata uang.
   */
  findByCodesWithPrice: (codes: string[]) =>
    prisma.currency.findMany({
      where: { code: { in: codes } },
      include: { price: true },
    }),

  findByCurrencyId: (currencyId: string) =>
    prisma.currencyPrice.findUnique({ where: { currencyId } }),

  upsert: ({
    currencyId,
    buyPrice,
    sellPrice,
    source,
    note,
    updatedBy,
    lastSyncedAt,
  }: UpsertCurrencyPriceInput) =>
    prisma.currencyPrice.upsert({
      where: { currencyId },
      create: {
        currencyId,
        buyPrice,
        sellPrice,
        source,
        note: note ?? null,
        updatedBy: updatedBy ?? null,
        lastSyncedAt: lastSyncedAt ?? null,
      },
      update: {
        buyPrice,
        sellPrice,
        source,
        note: note ?? null,
        updatedBy: updatedBy ?? null,
        // Hanya ditimpa saat jalur sync memberi nilai — edit manual tidak boleh
        // menghapus jejak kapan baris ini terakhir tersinkron.
        ...(lastSyncedAt ? { lastSyncedAt } : {}),
      },
    }),

  /**
   * Menulis banyak harga hasil sync dalam satu transaksi, supaya tidak pernah
   * ada keadaan setengah jadi kalau koneksi putus di tengah jalan.
   */
  upsertManySynced: (rows: UpsertCurrencyPriceInput[]) =>
    prisma.$transaction(rows.map((row) => currencyPriceRepository.upsert(row))),

  setLock: (currencyId: string, isLocked: boolean, updatedBy: string | null) =>
    prisma.currencyPrice.update({
      where: { currencyId },
      data: { isLocked, updatedBy },
    }),

  deleteByCurrencyId: async (currencyId: string): Promise<void> => {
    await prisma.currencyPrice.deleteMany({ where: { currencyId } });
  },
};

const SINGLETON_ID = "singleton";

export const currencyPriceSyncSettingRepository = {
  /** Selalu mengembalikan baris — dibuat dengan nilai default saat belum ada. */
  get: () =>
    prisma.currencyPriceSyncSetting.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID },
      update: {},
    }),

  /** Baca tanpa menulis — dipakai jalur cron yang boleh saja belum punya baris. */
  find: () => prisma.currencyPriceSyncSetting.findUnique({ where: { id: SINGLETON_ID } }),

  setAutoSync: (autoSync: boolean, updatedBy: string | null) =>
    prisma.currencyPriceSyncSetting.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, autoSync, updatedBy },
      update: { autoSync, updatedBy },
    }),

  recordRun: (summary: string) =>
    prisma.currencyPriceSyncSetting.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, lastRunAt: new Date(), lastRunSummary: summary },
      update: { lastRunAt: new Date(), lastRunSummary: summary },
    }),
};
