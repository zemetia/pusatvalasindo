import {
  smartdealRateRepository,
  smartdealScrapeStatusRepository,
} from "@/backend/repositories/smartdeal-rate.repository";
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

export interface SmartdealStatus {
  // False when the last scrape attempt failed — SmartDeal is unreachable or
  // its page structure changed, so the cached rates may be going stale.
  active: boolean;
  sourceUpdatedAt: string | null;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
}

export const smartdealRateService = {
  // Called by the trigger endpoint (src/app/api/scrape/smartdeal/route.ts).
  // Scrapes smartdeal.co.id live and upserts into SmartdealRate — everything
  // else reads the DB copy instead of hitting the site directly.
  //
  // Pembanding untuk penanda naik/turun adalah JAM PERUBAHAN TERAKHIR
  // SMARTDEAL, bukan jam kita melakukan refresh. Selama "Kurs diperbarui"
  // milik mereka belum bergeser, prevBuy/prevSell TIDAK ikut digeser walau
  // scrape dijalankan berkali-kali — kalau digeser, penanda perubahan lenyap
  // begitu poller 30 detik berikutnya jalan, padahal kursnya memang baru
  // berubah. Jadi prev selalu berisi kurs dari terbitan SmartDeal sebelumnya.
  //
  // Every attempt (success or failure) is recorded into
  // SmartdealScrapeStatus so Watcher Valas can show whether SmartDeal is
  // currently reachable — a failure here still rethrows (the cron caller
  // needs to know), but only after the failed attempt is on record.
  refreshFromSource: async (): Promise<{ count: number }> => {
    try {
      const [{ rates, sourceUpdatedAt }, existing, status] = await Promise.all([
        fetchSmartdealRates(),
        smartdealRateRepository.findAll(),
        smartdealScrapeStatusRepository.find(),
      ]);
      if (rates.length === 0) throw new Error("SmartDeal returned no rates");

      // true  → SmartDeal menerbitkan pembaruan baru sejak scrape terakhir
      // false → timestamp sumber sama persis (scrape ulang atas terbitan yang sama)
      // null  → timestamp sumber tak terbaca, tak bisa dipakai sebagai patokan
      const lastSourceUpdatedAt = status?.sourceUpdatedAt ?? null;
      const sourceMoved =
        sourceUpdatedAt == null || lastSourceUpdatedAt == null
          ? null
          : sourceUpdatedAt.getTime() !== lastSourceUpdatedAt.getTime();

      const existingByCode = new Map(existing.map((r) => [r.code, r]));
      const rows = rates.map((r) => {
        const prev = existingByCode.get(r.code);
        // Angka yang bergeser tanpa timestamp ikut bergeser tetap dihitung
        // perubahan — itu jalur cadangan saat `sourceMoved` null (timestamp
        // gagal diparse) sekaligus jaring pengaman kalau SmartDeal lupa
        // memperbarui jamnya sendiri.
        const valueMoved = prev == null || prev.buy !== r.buy || prev.sell !== r.sell;
        const advance = sourceMoved === true || valueMoved;
        return {
          code: r.code,
          name: r.name,
          buy: r.buy,
          sell: r.sell,
          prevBuy: advance ? prev?.buy ?? null : prev?.prevBuy ?? null,
          prevSell: advance ? prev?.sell ?? null : prev?.prevSell ?? null,
        };
      });

      await smartdealRateRepository.upsertMany(rows);
      await smartdealScrapeStatusRepository.recordSuccess(sourceUpdatedAt);
      return { count: rows.length };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await smartdealScrapeStatusRepository.recordFailure(message);
      throw e;
    }
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

  getStatus: async (): Promise<SmartdealStatus> => {
    const status = await smartdealScrapeStatusRepository.find();
    return {
      active: status != null && status.lastError == null,
      sourceUpdatedAt: status?.sourceUpdatedAt?.toISOString() ?? null,
      lastAttemptAt: status?.lastAttemptAt?.toISOString() ?? null,
      lastSuccessAt: status?.lastSuccessAt?.toISOString() ?? null,
      lastError: status?.lastError ?? null,
    };
  },
};
