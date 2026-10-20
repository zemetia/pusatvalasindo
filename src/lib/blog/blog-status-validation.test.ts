import { describe, expect, it } from "vitest";
import { displayStatus, isLive } from "./status";
import {
  createBlogPostSchema,
  updateBlogPostSchema,
  createBlogCategorySchema,
} from "@/lib/validations/blog";

const now = new Date("2026-10-20T05:00:00Z");

describe("displayStatus", () => {
  it("DRAFT & ARCHIVED apa adanya", () => {
    expect(displayStatus({ status: "DRAFT", publishedAt: null }, now)).toBe("DRAFT");
    expect(displayStatus({ status: "ARCHIVED", publishedAt: new Date("2026-01-01") }, now)).toBe("ARCHIVED");
  });
  it("PUBLISHED dengan tanggal lampau = PUBLISHED, masa depan = SCHEDULED", () => {
    expect(displayStatus({ status: "PUBLISHED", publishedAt: new Date("2026-10-19T00:00:00Z") }, now)).toBe("PUBLISHED");
    expect(displayStatus({ status: "PUBLISHED", publishedAt: now }, now)).toBe("PUBLISHED");
    expect(displayStatus({ status: "PUBLISHED", publishedAt: new Date("2026-10-21T00:00:00Z") }, now)).toBe("SCHEDULED");
    expect(displayStatus({ status: "PUBLISHED", publishedAt: "2026-10-21T00:00:00Z" }, now)).toBe("SCHEDULED");
  });
  it("PUBLISHED tanpa tanggal diperlakukan sebagai draft & tidak live", () => {
    expect(displayStatus({ status: "PUBLISHED", publishedAt: null }, now)).toBe("DRAFT");
    expect(isLive({ status: "PUBLISHED", publishedAt: null }, now)).toBe(false);
  });
  it("isLive hanya untuk PUBLISHED yang tanggalnya sudah lewat", () => {
    expect(isLive({ status: "PUBLISHED", publishedAt: new Date("2026-10-01") }, now)).toBe(true);
    expect(isLive({ status: "PUBLISHED", publishedAt: new Date("2026-11-01") }, now)).toBe(false);
    expect(isLive({ status: "DRAFT", publishedAt: new Date("2026-10-01") }, now)).toBe(false);
  });
});

const valid = {
  title: "Tips Tukar Dolar",
  excerpt: "Ringkasan artikel yang cukup panjang.",
  content: "# Halo\n\nIsi artikel.",
};

describe("createBlogPostSchema", () => {
  it("menerima input minimal", () => {
    expect(createBlogPostSchema.safeParse(valid).success).toBe(true);
  });
  it("menolak judul pendek, ringkasan pendek, dan isi kosong", () => {
    expect(createBlogPostSchema.safeParse({ ...valid, title: "ab" }).success).toBe(false);
    expect(createBlogPostSchema.safeParse({ ...valid, excerpt: "pendek" }).success).toBe(false);
    expect(createBlogPostSchema.safeParse({ ...valid, content: "   " }).success).toBe(false);
  });
  it("menolak slug tidak valid", () => {
    expect(createBlogPostSchema.safeParse({ ...valid, slug: "Slug Salah" }).success).toBe(false);
    expect(createBlogPostSchema.safeParse({ ...valid, slug: "slug-benar" }).success).toBe(true);
  });
  it("cover: https atau path root saja", () => {
    const ok = (u: string) => createBlogPostSchema.safeParse({ ...valid, coverImageUrl: u }).success;
    expect(ok("https://cdn.example.com/a.jpg")).toBe(true);
    expect(ok("/images/blog/a.jpg")).toBe(true);
    expect(ok("http://cdn.example.com/a.jpg")).toBe(false);
    expect(ok("//evil.com/a.jpg")).toBe(false);
    expect(ok("javascript:alert(1)")).toBe(false);
    expect(ok("a.jpg")).toBe(false);
  });
  it("string kosong dari form menjadi null, bukan error", () => {
    const r = createBlogPostSchema.parse({ ...valid, coverImageUrl: "", metaTitle: "  ", categoryId: "" });
    expect(r.coverImageUrl).toBeNull();
    expect(r.metaTitle).toBeNull();
    expect(r.categoryId).toBeNull();
  });
  it("batas panjang meta", () => {
    expect(createBlogPostSchema.safeParse({ ...valid, metaTitle: "x".repeat(71) }).success).toBe(false);
    expect(createBlogPostSchema.safeParse({ ...valid, metaDescription: "x".repeat(171) }).success).toBe(false);
  });
  it("publishedAt harus ISO dengan zona waktu", () => {
    expect(createBlogPostSchema.safeParse({ ...valid, publishedAt: "2026-10-21T10:00:00.000Z" }).success).toBe(true);
    expect(createBlogPostSchema.safeParse({ ...valid, publishedAt: "2026-10-21T10:00:00+07:00" }).success).toBe(true);
    expect(createBlogPostSchema.safeParse({ ...valid, publishedAt: "2026-10-21 10:00" }).success).toBe(false);
    expect(createBlogPostSchema.safeParse({ ...valid, publishedAt: "kemarin" }).success).toBe(false);
  });
  it("status hanya DRAFT/PUBLISHED/ARCHIVED", () => {
    expect(createBlogPostSchema.safeParse({ ...valid, status: "SCHEDULED" }).success).toBe(false);
    expect(createBlogPostSchema.safeParse({ ...valid, status: "PUBLISHED" }).success).toBe(true);
  });
});

describe("updateBlogPostSchema", () => {
  it("semua field opsional, tetapi yang ada tetap divalidasi", () => {
    expect(updateBlogPostSchema.safeParse({}).success).toBe(true);
    expect(updateBlogPostSchema.safeParse({ title: "Judul baru" }).success).toBe(true);
    expect(updateBlogPostSchema.safeParse({ title: "x" }).success).toBe(false);
  });
});

describe("createBlogCategorySchema", () => {
  it("nama wajib, slug opsional", () => {
    expect(createBlogCategorySchema.safeParse({ name: "Tips Valas" }).success).toBe(true);
    expect(createBlogCategorySchema.safeParse({ name: "x" }).success).toBe(false);
    expect(createBlogCategorySchema.safeParse({ name: "Tips", slug: "Tips Valas" }).success).toBe(false);
  });
});
