import { describe, expect, it } from "vitest";
import { slugify, isValidSlug } from "./slug";
import { countWords, extractFaqs, readingMinutes, stripMarkdown } from "./content";
import { isBotUserAgent, jakartaDay, normalizeReferrerHost, visitorHash } from "./tracking";
import {
  fillDailySeries,
  jakartaStartOfDay,
  parseRangeDays,
  pctChange,
  resolveRange,
} from "./analytics-range";

describe("slugify", () => {
  it("menurunkan judul ke slug URL", () => {
    expect(slugify("Tips Tukar Dolar di Jakarta!")).toBe("tips-tukar-dolar-di-jakarta");
  });
  it("membuang diakritik dan mengganti & dengan dan", () => {
    expect(slugify("Café & Rupiah")).toBe("cafe-dan-rupiah");
  });
  it("memampatkan pemisah dan memangkas tepi", () => {
    expect(slugify("  --Kurs   USD/IDR--  ")).toBe("kurs-usd-idr");
  });
  it("memotong di batas kata, bukan di tengah kata", () => {
    const s = slugify("kata ".repeat(40), 30);
    expect(s.length).toBeLessThanOrEqual(30);
    expect(s.endsWith("-")).toBe(false);
    expect(s.split("-").every((w) => w === "kata")).toBe(true);
  });
  it("menghasilkan string kosong untuk judul tanpa huruf/angka", () => {
    expect(slugify("!!!")).toBe("");
    expect(isValidSlug("")).toBe(false);
  });
  it("isValidSlug menolak huruf besar, spasi, dan garis ganda", () => {
    expect(isValidSlug("ok-slug-2")).toBe(true);
    expect(isValidSlug("Ok")).toBe(false);
    expect(isValidSlug("a--b")).toBe(false);
    expect(isValidSlug("-a")).toBe(false);
    expect(isValidSlug("a b")).toBe(false);
  });
});

describe("content", () => {
  it("menghitung kata tanpa sintaks Markdown", () => {
    const md = "# Judul\n\nIni **tebal** dan [tautan](https://x.id).\n\n![gambar](a.png)\n\n```js\nconst a = 1\n```\n\n- satu\n- dua";
    expect(stripMarkdown(md)).toBe("Judul Ini tebal dan tautan. satu dua");
    expect(countWords(md)).toBe(7);
  });
  it("waktu baca minimal 1 menit dan membulat ke atas", () => {
    expect(readingMinutes("")).toBe(1);
    expect(readingMinutes("kata ".repeat(200))).toBe(1);
    expect(readingMinutes("kata ".repeat(201))).toBe(2);
  });
  it("extractFaqs: kosong jika tidak ada bagian FAQ", () => {
    expect(extractFaqs("# Judul\n\nIsi artikel biasa tanpa tanya jawab.")).toEqual([]);
  });
  it("extractFaqs: mengekstrak Q&A dari heading FAQ dan berhenti di heading H2 berikutnya", () => {
    const md = `
# Panduan Valas

Teks pendahuluan.

## Pertanyaan Umum

### Apakah bisa tukar uang lewat kurir?
Bisa! Kami menyediakan **layanan antar kurir** di Jakarta & Tangerang.

### Berapa batas minimal penukaran?
Tidak ada minimum nominal untuk transaksi di kantor.

## Kesimpulan
Selesai.
    `.trim();

    const faqs = extractFaqs(md);
    expect(faqs).toHaveLength(2);
    expect(faqs[0].question).toBe("Apakah bisa tukar uang lewat kurir?");
    expect(faqs[0].answer).toBe("Bisa! Kami menyediakan layanan antar kurir di Jakarta & Tangerang.");
    expect(faqs[1].question).toBe("Berapa batas minimal penukaran?");
    expect(faqs[1].answer).toBe("Tidak ada minimum nominal untuk transaksi di kantor.");
  });

  it("extractFaqs: mendukung format CRLF dan heading # FAQ", () => {
    const md = "# FAQ\r\n\r\n### Kurs apa saja yang tersedia?\r\nUSD, SGD, EUR.\r\n\r\n# Bagian Lain\r\nSelesai.";
    const faqs = extractFaqs(md);
    expect(faqs).toHaveLength(1);
    expect(faqs[0].question).toBe("Kurs apa saja yang tersedia?");
    expect(faqs[0].answer).toBe("USD, SGD, EUR.");
  });
});

describe("tracking", () => {
  it("mengenali bot dan UA kosong", () => {
    expect(isBotUserAgent("")).toBe(true);
    expect(isBotUserAgent(null)).toBe(true);
    expect(isBotUserAgent("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")).toBe(true);
    expect(isBotUserAgent("curl/8.4.0")).toBe(true);
    expect(isBotUserAgent("Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/120.0 Safari/537.36")).toBe(true);
  });
  it("tidak menandai browser biasa sebagai bot", () => {
    expect(
      isBotUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
      )
    ).toBe(false);
    expect(
      isBotUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1"
      )
    ).toBe(false);
  });
  it("hash pengunjung stabil dalam sehari, berbeda lintas hari/IP/UA", () => {
    const a = visitorHash("1.2.3.4", "UA", "2026-10-20", "s");
    expect(a).toBe(visitorHash("1.2.3.4", "UA", "2026-10-20", "s"));
    expect(a).not.toBe(visitorHash("1.2.3.4", "UA", "2026-10-21", "s"));
    expect(a).not.toBe(visitorHash("1.2.3.5", "UA", "2026-10-20", "s"));
    expect(a).not.toBe(visitorHash("1.2.3.4", "UB", "2026-10-20", "s"));
    expect(a).toHaveLength(32);
  });
  it("jakartaDay memakai WIB (UTC+7)", () => {
    expect(jakartaDay(new Date("2026-10-19T16:59:59Z"))).toBe("2026-10-19");
    expect(jakartaDay(new Date("2026-10-19T17:00:00Z"))).toBe("2026-10-20");
  });
  it("normalizeReferrerHost: eksternal → host, internal/invalid → null", () => {
    const own = ["pusatvalasindo.com", "localhost:3000"];
    expect(normalizeReferrerHost("https://www.google.com/search?q=x", own)).toBe("google.com");
    expect(normalizeReferrerHost("https://pusatvalasindo.com/blog", own)).toBeNull();
    expect(normalizeReferrerHost("https://www.pusatvalasindo.com/", own)).toBeNull();
    expect(normalizeReferrerHost("http://localhost:3000/x", own)).toBeNull();
    expect(normalizeReferrerHost("javascript:alert(1)", own)).toBeNull();
    expect(normalizeReferrerHost("bukan url", own)).toBeNull();
    expect(normalizeReferrerHost("", own)).toBeNull();
    expect(normalizeReferrerHost(undefined, own)).toBeNull();
  });
});

describe("analytics-range", () => {
  it("parseRangeDays hanya menerima 7/30/90, selain itu 30", () => {
    expect(parseRangeDays("7")).toBe(7);
    expect(parseRangeDays(["90"])).toBe(90);
    expect(parseRangeDays("15")).toBe(30);
    expect(parseRangeDays(undefined)).toBe(30);
    expect(parseRangeDays("abc")).toBe(30);
  });
  it("jakartaStartOfDay = 00:00 WIB", () => {
    expect(jakartaStartOfDay(new Date("2026-10-20T05:00:00Z")).toISOString()).toBe("2026-10-19T17:00:00.000Z");
    // 17:30 UTC sudah tanggal berikutnya di WIB.
    expect(jakartaStartOfDay(new Date("2026-10-19T17:30:00Z")).toISOString()).toBe("2026-10-19T17:00:00.000Z");
  });
  it("resolveRange mencakup hari ini dan menyediakan pembanding sama panjang", () => {
    const now = new Date("2026-10-20T05:00:00Z"); // 20 Okt 12:00 WIB
    const r = resolveRange(7, now);
    expect(r.to.toISOString()).toBe("2026-10-20T17:00:00.000Z"); // besok 00:00 WIB
    expect(r.from.toISOString()).toBe("2026-10-13T17:00:00.000Z"); // 14 Okt 00:00 WIB
    expect(r.prevTo.getTime()).toBe(r.from.getTime());
    expect(r.prevTo.getTime() - r.prevFrom.getTime()).toBe(r.to.getTime() - r.from.getTime());
  });
  it("pctChange: null bila pembanding 0", () => {
    expect(pctChange(5, 0)).toBeNull();
    expect(pctChange(15, 10)).toBeCloseTo(50);
    expect(pctChange(5, 10)).toBeCloseTo(-50);
    expect(pctChange(0, 10)).toBeCloseTo(-100);
  });
  it("fillDailySeries mengisi hari kosong dengan 0 dan berurutan", () => {
    const r = resolveRange(3, new Date("2026-10-20T05:00:00Z"));
    const out = fillDailySeries([{ day: "2026-10-19", views: 4, visitors: 2 }], r.from, 3);
    expect(out.map((p) => p.day)).toEqual(["2026-10-18", "2026-10-19", "2026-10-20"]);
    expect(out.map((p) => p.views)).toEqual([0, 4, 0]);
  });
});
