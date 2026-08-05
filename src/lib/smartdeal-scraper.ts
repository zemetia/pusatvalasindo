export interface ScrapedSmartdealRate {
  code: string;
  name: string;
  buy: number;
  sell: number;
}

export interface ScrapedSmartdealResult {
  rates: ScrapedSmartdealRate[];
  // SmartDeal's own self-reported "Kurs diperbarui: <...>" timestamp (the
  // `LIVE_UPDATED` JS literal on their homepage) — when THEY last refreshed
  // their rate table, as opposed to when we last scraped it. Their site is
  // WIB (Jakarta), so this is parsed as UTC+7. Null if the field is missing
  // or unparseable (page structure changed) — callers should not treat that
  // as a hard failure since the rates themselves still parsed fine.
  sourceUpdatedAt: Date | null;
}

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

// Parses SmartDeal's "05 Aug 2026 11:49:43" format (their own local WIB
// clock, not ISO) into a UTC Date.
function parseSmartdealTimestamp(raw: string): Date | null {
  const match = raw.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, day, monAbbr, year, hour, minute, second] = match;
  const month = MONTHS[monAbbr.toLowerCase()];
  if (month === undefined) return null;

  // WIB is UTC+7 with no DST — build the UTC instant directly.
  const utcMs = Date.UTC(Number(year), month, Number(day), Number(hour) - 7, Number(minute), Number(second));
  return new Date(utcMs);
}

// SmartDeal server-renders its rate table into `LIVE_RATES` / `LIVE_UPDATED`
// JS literals embedded in the homepage <script> tag (no separate JSON API).
export async function fetchSmartdealRates(): Promise<ScrapedSmartdealResult> {
  const res = await fetch("https://smartdeal.co.id", {
    headers: { "User-Agent": "Mozilla/5.0" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const html = await res.text();
  const match = html.match(/const LIVE_RATES\s*=\s*(\[.*?\]);/s);
  if (!match) throw new Error("rate data not found in page");

  const raw = JSON.parse(match[1]) as Array<{
    code: string;
    name: string;
    buy_raw?: number;
    sell_raw?: number;
    base?: boolean;
  }>;

  const rates = raw
    .filter((r) => !r.base && typeof r.buy_raw === "number" && typeof r.sell_raw === "number")
    .map((r) => ({ code: r.code, name: r.name, buy: r.buy_raw as number, sell: r.sell_raw as number }));

  const updatedMatch = html.match(/const LIVE_UPDATED\s*=\s*"([^"]+)"/);
  const sourceUpdatedAt = updatedMatch ? parseSmartdealTimestamp(updatedMatch[1]) : null;

  return { rates, sourceUpdatedAt };
}
