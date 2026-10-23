import { beforeEach, describe, expect, it, vi } from "vitest";

const { listForFeeds } = vi.hoisted(() => ({ listForFeeds: vi.fn() }));
vi.mock("@/backend/services/blog.service", () => ({ blogService: { listForFeeds } }));

// routing.ts menarik next-intl/navigation yang tidak bisa dimuat di vitest; sitemap hanya butuh defaultLocale.
vi.mock("@/i18n/routing", () => ({ routing: { defaultLocale: "id" } }));

import sitemap from "./sitemap";

const post = (slug: string, updatedAt: string, category: { name: string; slug: string } | null) => ({
  slug,
  title: slug,
  excerpt: "x",
  coverImageUrl: null,
  publishedAt: new Date("2026-10-01T00:00:00Z"),
  updatedAt: new Date(updatedAt),
  category,
});

describe("sitemap — halaman kategori blog", () => {
  beforeEach(() => listForFeeds.mockReset());

  it("memuat satu entri per kategori yang punya artikel tayang, dengan lastModified artikel terbarunya", async () => {
    listForFeeds.mockResolvedValue([
      post("a", "2026-10-05T00:00:00Z", { name: "Kurs", slug: "kurs" }),
      post("b", "2026-10-09T00:00:00Z", { name: "Kurs", slug: "kurs" }),
      post("c", "2026-10-07T00:00:00Z", { name: "Tips", slug: "tips" }),
      post("d", "2026-10-08T00:00:00Z", null),
    ]);

    const entries = (await sitemap()).filter((e) => e.url.includes("/blog/kategori/"));

    expect(entries.map((e) => e.url).sort()).toEqual(
      expect.arrayContaining([expect.stringMatching(/\/blog\/kategori\/kurs$/), expect.stringMatching(/\/blog\/kategori\/tips$/)])
    );
    const kurs = entries.find((e) => e.url.endsWith("/blog/kategori/kurs"));
    expect(kurs?.lastModified).toEqual(new Date("2026-10-09T00:00:00Z"));
    expect(entries.some((e) => e.url.includes("kategori/null"))).toBe(false);
  });

  it("tanpa artikel tidak ada entri kategori", async () => {
    listForFeeds.mockResolvedValue([]);
    expect((await sitemap()).some((e) => e.url.includes("/blog/kategori/"))).toBe(false);
  });
});
