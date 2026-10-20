import { createHash } from "node:crypto";

/**
 * Penyaring bot yang sengaja agresif: lebih baik melewatkan sedikit manusia
 * daripada menggelembungkan angka dengan crawler. UA kosong dianggap bot —
 * browser sungguhan selalu mengirimnya.
 */
const BOT_UA =
  /bot|crawl|spider|slurp|facebookexternalhit|embedly|headless|lighthouse|pagespeed|gtmetrix|pingdom|uptime|monitor|curl\/|wget|python-requests|aiohttp|httpclient|axios|node-fetch|undici|go-http-client|java\/|okhttp|scrapy|phantomjs|puppeteer|playwright|preview/i;

export function isBotUserAgent(ua: string | null | undefined): boolean {
  if (!ua || ua.trim().length < 10) return true;
  return BOT_UA.test(ua);
}

/** Tanggal (YYYY-MM-DD) di Asia/Jakarta — WIB tidak mengenal DST, jadi offset tetap +7. */
export function jakartaDay(d: Date): string {
  return new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
}

/**
 * Hash pengunjung HARIAN. Tanggal ikut di dalamnya, jadi orang yang sama
 * menghasilkan hash berbeda tiap hari — angka "pengunjung" adalah pengunjung
 * unik per hari, dan hash tidak bisa dipakai melacak seseorang lintas hari.
 * IP/UA mentah tidak pernah disimpan.
 */
export function visitorHash(ip: string, ua: string, day: string, secret: string): string {
  return createHash("sha256").update(`${secret}\u0000${day}\u0000${ip}\u0000${ua}`).digest("hex").slice(0, 32);
}

const stripWww = (h: string) => h.toLowerCase().replace(/^www\./, "");

/**
 * Host asal kunjungan dari `document.referrer`. null untuk kunjungan langsung,
 * referrer internal (situs ini sendiri), atau nilai yang bukan URL http(s).
 */
export function normalizeReferrerHost(
  raw: string | null | undefined,
  ownHosts: Array<string | null | undefined>
): string | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  const host = stripWww(url.hostname);
  if (!host || host.length > 100) return null;
  const own = ownHosts.filter((h): h is string => !!h).map((h) => stripWww(h.split(":")[0]));
  if (own.includes(host)) return null;
  return host;
}
