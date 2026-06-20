import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();



export interface RateResult {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
}

const symbols = [
  'USDIDR=X',
  'EURIDR=X',
  'SGDIDR=X',
  'JPYIDR=X',
  'CNYIDR=X',
  'AUDIDR=X',
  'HKDIDR=X',
];

let cache: { data: RateResult[]; timestamp: number } | null = null;
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

export async function getExchangeRates(): Promise<RateResult[]> {
  const now = Date.now();
  if (cache && now - cache.timestamp < CACHE_DURATION) {
    return cache.data;
  }

  try {
    const results = await Promise.all(
      symbols.map(async (symbol) => {
        try {
          const quote = await yahooFinance.quote(symbol);
          
          if (!quote) {
            return null;
          }

          return {
            symbol: symbol.replace('IDR=X', ''),
            price: quote.regularMarketPrice || 0,
            change: quote.regularMarketChange || 0,
            changePercent: quote.regularMarketChangePercent || 0,
          };
        } catch (e) {
          console.warn(`[Rates] Failed to fetch ${symbol}`);
          return null;
        }
      })
    );
    
    const filteredResults = results.filter((r): r is RateResult => r !== null);
    
    if (filteredResults.length > 0) {
      cache = { data: filteredResults, timestamp: now };
    }
    
    return filteredResults;
  } catch (error) {
    console.error('Error fetching rates from Yahoo Finance:', error);
    return cache?.data || [];
  }
}
