import YahooFinance from "yahoo-finance2";
import { smartdealRateService, type SmartdealStatus } from "@/backend/services/smartdeal-rate.service";

// Currency-rate watcher: cross-references SmartDeal's public counter rates
// (banknote buy/sell) against Yahoo Finance's market mid-rate. SmartDeal
// rates come from the DB cache kept fresh by an external scheduler hitting
// src/app/api/scrape/smartdeal/route.ts, rather than a live scrape on every
// request; Yahoo/ExchangeRate-API are still fetched live here.

const yahooFinance = new YahooFinance();

const DEFAULT_CODES = [
  "USD", "EUR", "SGD", "AUD", "GBP", "JPY", "CNY", "MYR", "THB", "HKD",
];

export interface WatcherValasRow {
  code: string;
  name: string;
  smartdealBuy: number | null;
  smartdealSell: number | null;
  // Kurs dari terbitan SmartDeal sebelumnya (patokan penanda naik/turun),
  // bukan dari scrape kita sebelumnya — null kalau belum ada pembanding.
  smartdealPrevBuy: number | null;
  smartdealPrevSell: number | null;
  yahooRate: number | null;
  exchangeRateApiRate: number | null;
}

export interface WatcherValasData {
  updatedAt: string;
  // Timestamp of the DB-cached SmartDeal snapshot (when the cron job last
  // fetched it) — distinct from `updatedAt`, which is when this response
  // itself was assembled. Null if the cron hasn't populated the table yet.
  smartdealFetchedAt: string | null;
  // Whether the SmartDeal scrape is currently reachable ("aktif"/"down"),
  // plus SmartDeal's own self-reported "Kurs diperbarui" timestamp.
  smartdealStatus: SmartdealStatus;
  rows: WatcherValasRow[];
  errors: { source: string; message: string }[];
}

// Yahoo's plain HTTP quote endpoint now requires a crumb/cookie handshake
// (returns 401 without it); the yahoo-finance2 client handles that for us.
async function fetchYahooRates(codes: string[]): Promise<Record<string, number>> {
  if (codes.length === 0) return {};

  const entries = await Promise.all(
    codes.map(async (code) => {
      try {
        const quote = await yahooFinance.quote(`${code}IDR=X`);
        return quote?.regularMarketPrice != null ? ([code, quote.regularMarketPrice] as const) : null;
      } catch {
        return null;
      }
    })
  );

  const rates: Record<string, number> = {};
  for (const entry of entries) {
    if (entry) rates[entry[0]] = entry[1];
  }
  if (Object.keys(rates).length === 0) throw new Error("no quotes returned");
  return rates;
}

// Single call for ALL currencies (base=IDR), rates come back as "1 IDR = X
// foreign currency" — invert (1/rate) to match the "IDR per 1 unit foreign
// currency" convention used everywhere else on this page.
async function fetchExchangeRateApiRates(): Promise<Record<string, number>> {
  const apiKey = process.env.EXCHANGERATE_API_KEY;
  if (!apiKey) throw new Error("EXCHANGERATE_API_KEY not configured");

  const res = await fetch(`https://v6.exchangerate-api.com/v6/${apiKey}/latest/IDR`, {
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const json = await res.json();
  if (json?.result !== "success") throw new Error(json?.["error-type"] ?? "unexpected response");

  const conversionRates: Record<string, number> = json.conversion_rates ?? {};
  const rates: Record<string, number> = {};
  for (const [code, rate] of Object.entries(conversionRates)) {
    if (code === "IDR" || typeof rate !== "number" || rate === 0) continue;
    rates[code] = 1 / rate;
  }
  return rates;
}

export async function getWatcherValasData(): Promise<WatcherValasData> {
  const errors: { source: string; message: string }[] = [];

  let smartdeal: {
    code: string;
    name: string;
    buy: number;
    sell: number;
    prevBuy: number | null;
    prevSell: number | null;
  }[] = [];
  let smartdealFetchedAt: string | null = null;
  try {
    const cached = await smartdealRateService.getLatest();
    if (cached.length === 0) throw new Error("no cached rates yet — cron hasn't run");
    smartdeal = cached;
    smartdealFetchedAt = cached.reduce<string | null>(
      (latest, r) => (latest === null || r.fetchedAt > latest ? r.fetchedAt : latest),
      null
    );
  } catch (e) {
    errors.push({ source: "SmartDeal", message: e instanceof Error ? e.message : String(e) });
  }

  const smartdealStatus = await smartdealRateService.getStatus();

  const codes = smartdeal.length > 0 ? smartdeal.map((r) => r.code) : DEFAULT_CODES;
  let yahoo: Record<string, number> = {};
  try {
    yahoo = await fetchYahooRates(codes);
  } catch (e) {
    errors.push({ source: "Yahoo Finance", message: e instanceof Error ? e.message : String(e) });
  }

  let exchangeRateApi: Record<string, number> = {};
  try {
    exchangeRateApi = await fetchExchangeRateApiRates();
  } catch (e) {
    errors.push({ source: "ExchangeRate-API", message: e instanceof Error ? e.message : String(e) });
  }

  // ExchangeRate-API covers ~160 currencies IDR doesn't otherwise trade with —
  // only use it to fill in rows we already track, not to add new ones.
  const codeSet = new Set<string>([...smartdeal.map((r) => r.code), ...Object.keys(yahoo)]);
  const rows: WatcherValasRow[] = Array.from(codeSet)
    .sort()
    .map((code) => {
      const sd = smartdeal.find((r) => r.code === code);
      return {
        code,
        name: sd?.name ?? code,
        smartdealBuy: sd?.buy ?? null,
        smartdealSell: sd?.sell ?? null,
        smartdealPrevBuy: sd?.prevBuy ?? null,
        smartdealPrevSell: sd?.prevSell ?? null,
        yahooRate: yahoo[code] ?? null,
        exchangeRateApiRate: exchangeRateApi[code] ?? null,
      };
    });

  return { updatedAt: new Date().toISOString(), smartdealFetchedAt, smartdealStatus, rows, errors };
}
