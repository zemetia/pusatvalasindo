import {
  currencyPriceRepository,
  currencyPriceSyncSettingRepository,
  type UpsertCurrencyPriceInput,
} from "@/backend/repositories/currency-price.repository";
import { priceBenchmarkService } from "@/backend/services/price-benchmark.service";
import {
  toCurrencyPriceRow,
  assertValidPricePair,
  type CurrencyPriceRow,
} from "@/backend/services/currency-price.service";

/**
 * ─── Sinkronisasi Harga Valas ────────────────────────────────────────────────
 *
 * Alurnya satu arah:
 *
 *   SmartDeal (kurs pasar)  →  Patokan Harga (aturan penyesuaian)  →  Harga Valas
 *
 * Modul ini adalah anak panah terakhir. Ada tiga pemicu — tombol "Sync sekarang"
 * di Harga Valas, tombol "Terapkan" di Patokan Harga, dan hook auto di ujung
 * scrape SmartDeal — tapi ketiganya memanggil `run()` yang sama. Jangan pernah
 * menduplikasi logikanya per pemicu: kalau tidak, cepat atau lambat aturan
 * gemboknya berbeda di salah satu jalur.
 */

/** Kenapa sebuah baris tidak ikut diperbarui. */
export type SkipReason = "LOCKED" | "INVALID" | "NO_CURRENCY";

export interface SyncSkipped {
  code: string;
  reason: SkipReason;
  detail?: string;
}

export interface SyncResult {
  updated: number;
  skipped: SyncSkipped[];
  /** Baris hasil sync, siap dipakai UI untuk menyegarkan tabel tanpa reload. */
  rows: CurrencyPriceRow[];
  /** Ringkasan satu baris untuk toast dan `lastRunSummary`. */
  summary: string;
}

function describe(result: Omit<SyncResult, "summary" | "rows">): string {
  const locked = result.skipped.filter((s) => s.reason === "LOCKED").length;
  const invalid = result.skipped.filter((s) => s.reason === "INVALID").length;
  const missing = result.skipped.filter((s) => s.reason === "NO_CURRENCY").length;

  const parts = [`${result.updated} diperbarui`];
  if (locked) parts.push(`${locked} terkunci dilewati`);
  if (invalid) parts.push(`${invalid} dilewati (jual < beli)`);
  if (missing) parts.push(`${missing} belum ada di master mata uang`);
  return parts.join(" · ");
}

export const currencyPriceSyncService = {
  getSetting: async () => {
    const setting = await currencyPriceSyncSettingRepository.get();
    return {
      autoSync: setting.autoSync,
      lastRunAt: setting.lastRunAt?.toISOString() ?? null,
      lastRunSummary: setting.lastRunSummary,
    };
  },

  setAutoSync: async (autoSync: boolean, updatedBy: string | null) => {
    const setting = await currencyPriceSyncSettingRepository.setAutoSync(autoSync, updatedBy);
    return {
      autoSync: setting.autoSync,
      lastRunAt: setting.lastRunAt?.toISOString() ?? null,
      lastRunSummary: setting.lastRunSummary,
    };
  },

  /**
   * Menyalurkan patokan harga terkini ke Harga Valas.
   *
   * `actor` masuk ke `updatedBy` — id user untuk sync manual, `"auto-sync"`
   * untuk jalur cron, supaya jejaknya bisa dibedakan belakangan.
   *
   * Baris yang dilewati TIDAK menggagalkan batch: satu aturan penyesuaian yang
   * menghasilkan jual di bawah beli tidak boleh menahan 20-an mata uang lain.
   */
  run: async ({ actor }: { actor: string }): Promise<SyncResult> => {
    const quotes = await priceBenchmarkService.getQuotes();
    if (quotes.length === 0) {
      const empty = { updated: 0, skipped: [] as SyncSkipped[] };
      return { ...empty, rows: [], summary: describe(empty) };
    }

    // Dicocokkan lewat kode mata uang: `Currency.code` unik dan `PriceBenchmark`
    // memakai kode yang sama. SmartDeal cuma mengutip belasan mata uang,
    // sedangkan master berisi ratusan — jadi hanya kode terkutip yang diambil.
    const currencies = await currencyPriceRepository.findByCodesWithPrice(
      quotes.map((q) => q.code)
    );
    const byCode = new Map(currencies.map((c) => [c.code, c]));

    const skipped: SyncSkipped[] = [];
    const writes: UpsertCurrencyPriceInput[] = [];
    const now = new Date();

    for (const quote of quotes) {
      const currency = byCode.get(quote.code);

      // Mata uang yang dikutip SmartDeal tapi belum ada di master sengaja TIDAK
      // dibuat otomatis — menambah mata uang adalah keputusan manusia.
      if (!currency) {
        skipped.push({ code: quote.code, reason: "NO_CURRENCY" });
        continue;
      }

      // Gembok adalah satu-satunya pelindung. Baris yang diedit manual tapi
      // tidak dikunci memang ditimpa di sini — itu perilaku yang diinginkan.
      if (currency.price?.isLocked) {
        skipped.push({ code: quote.code, reason: "LOCKED" });
        continue;
      }

      try {
        assertValidPricePair(quote.buy, quote.sell);
      } catch (e) {
        skipped.push({
          code: quote.code,
          reason: "INVALID",
          detail: e instanceof Error ? e.message : undefined,
        });
        continue;
      }

      writes.push({
        currencyId: currency.id,
        buyPrice: quote.buy,
        sellPrice: quote.sell,
        source: "SYNCED",
        note: currency.price?.note ?? null,
        updatedBy: actor,
        lastSyncedAt: now,
      });
    }

    const written = writes.length > 0 ? await currencyPriceRepository.upsertManySynced(writes) : [];

    // Dipetakan lewat currencyId, bukan diasumsikan berurutan dengan `writes`.
    const byId = new Map(currencies.map((c) => [c.id, c]));
    const rows = written.flatMap((price) => {
      const currency = byId.get(price.currencyId);
      return currency ? [toCurrencyPriceRow({ ...currency, price })] : [];
    });

    const result = { updated: written.length, skipped };
    const summary = describe(result);
    await currencyPriceSyncSettingRepository.recordRun(summary);

    return { ...result, rows, summary };
  },

  /**
   * Jalur auto: dipanggil di ujung scrape SmartDeal. Diam saja kalau saklarnya
   * mati, dan TIDAK PERNAH melempar — kurs yang sudah berhasil disimpan tidak
   * boleh ikut gagal gara-gara sinkronisasi turunannya.
   */
  runIfAutoEnabled: async (): Promise<
    { ran: false } | { ran: true; summary: string } | { ran: true; error: string }
  > => {
    try {
      const setting = await currencyPriceSyncSettingRepository.find();
      if (!setting?.autoSync) return { ran: false };

      const result = await currencyPriceSyncService.run({ actor: "auto-sync" });
      return { ran: true, summary: result.summary };
    } catch (e) {
      return { ran: true, error: e instanceof Error ? e.message : String(e) };
    }
  },
};
