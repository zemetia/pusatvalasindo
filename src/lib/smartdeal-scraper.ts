export interface ScrapedSmartdealRate {
  code: string;
  name: string;
  buy: number;
  sell: number;
}

// SmartDeal server-renders its rate table into a `LIVE_RATES` JS array
// literal embedded in the homepage <script> tag (no separate JSON API).
export async function fetchSmartdealRates(): Promise<ScrapedSmartdealRate[]> {
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

  return raw
    .filter((r) => !r.base && typeof r.buy_raw === "number" && typeof r.sell_raw === "number")
    .map((r) => ({ code: r.code, name: r.name, buy: r.buy_raw as number, sell: r.sell_raw as number }));
}
