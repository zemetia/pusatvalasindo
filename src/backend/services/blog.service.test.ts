import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { post, category, view } = vi.hoisted(() => ({
  post: {
    findById: vi.fn(),
    slugTaken: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findLiveId: vi.fn(),
    countLive: vi.fn(),
    listLive: vi.fn(),
    findLiveCategoryBySlug: vi.fn(),
  },
  category: { findById: vi.fn(), findBySlug: vi.fn(), create: vi.fn() },
  view: { hasViewSince: vi.fn(), record: vi.fn() },
}));

vi.mock("@/backend/repositories/blog-post.repository", () => ({ blogPostRepository: post }));
vi.mock("@/backend/repositories/blog-category.repository", () => ({ blogCategoryRepository: category }));
vi.mock("@/backend/repositories/blog-view.repository", () => ({ blogViewRepository: view }));

import { blogService, resolvePublishedAt, VIEW_DEDUP_WINDOW_MS } from "./blog.service";
import { ConflictError, NotFoundError, ValidationError } from "@/backend/errors/app-error";

const NOW = new Date("2026-10-20T05:00:00.000Z");
const base = {
  title: "Tips Tukar Dolar di Jakarta",
  excerpt: "Ringkasan artikel yang cukup panjang.",
  content: "Isi artikel. ".repeat(10),
};

const row = (over: Record<string, unknown> = {}) => ({
  id: "p1",
  slug: "tips-tukar-dolar-di-jakarta",
  status: "DRAFT",
  publishedAt: null,
  ...base,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  post.slugTaken.mockResolvedValue(false);
  post.create.mockImplementation(async (d) => ({ id: "p1", ...d }));
  post.update.mockImplementation(async (id, d) => ({ ...row(), id, ...d }));
});

describe("resolvePublishedAt", () => {
  it("tanggal eksplisit dipakai apa adanya (jadwal / backdate)", () => {
    expect(resolvePublishedAt("PUBLISHED", "2026-11-01T00:00:00.000Z", null, NOW)?.toISOString()).toBe(
      "2026-11-01T00:00:00.000Z"
    );
  });
  it("menerbitkan tanpa tanggal → sekarang; draft tanpa tanggal → null", () => {
    expect(resolvePublishedAt("PUBLISHED", undefined, null, NOW)).toEqual(NOW);
    expect(resolvePublishedAt("DRAFT", undefined, null, NOW)).toBeNull();
  });
  it("tanggal lama dipertahankan saat terbit ulang (datePublished stabil)", () => {
    const first = new Date("2026-09-01T00:00:00Z");
    expect(resolvePublishedAt("PUBLISHED", undefined, first, NOW)).toEqual(first);
    expect(resolvePublishedAt("DRAFT", undefined, first, NOW)).toEqual(first);
  });
  it("mengosongkan tanggal: null untuk draft, tetapi artikel terbit tetap wajib bertanggal", () => {
    expect(resolvePublishedAt("DRAFT", null, new Date("2026-09-01"), NOW)).toBeNull();
    expect(resolvePublishedAt("PUBLISHED", null, new Date("2026-09-01"), NOW)).toEqual(NOW);
  });
});

describe("createPost", () => {
  it("membuat slug dari judul, default DRAFT, tanpa tanggal terbit", async () => {
    const r = await blogService.createPost(base, "u1", NOW);
    expect(post.create).toHaveBeenCalledTimes(1);
    const data = post.create.mock.calls[0][0];
    expect(data.slug).toBe("tips-tukar-dolar-di-jakarta");
    expect(data.status).toBe("DRAFT");
    expect(data.publishedAt).toBeNull();
    expect(data.authorId).toBe("u1");
    expect(data.readingMinutes).toBe(1);
    expect(r.displayStatus).toBe("DRAFT");
  });

  it("slug otomatis yang bentrok diberi sufiks -2, -3", async () => {
    post.slugTaken.mockImplementation(async (s: string) => ["tips-tukar-dolar-di-jakarta", "tips-tukar-dolar-di-jakarta-2"].includes(s));
    await blogService.createPost(base, null, NOW);
    expect(post.create.mock.calls[0][0].slug).toBe("tips-tukar-dolar-di-jakarta-3");
  });

  it("slug eksplisit yang bentrok ditolak (tidak diam-diam diubah)", async () => {
    post.slugTaken.mockResolvedValue(true);
    await expect(blogService.createPost({ ...base, slug: "sudah-ada" }, null, NOW)).rejects.toBeInstanceOf(ConflictError);
    expect(post.create).not.toHaveBeenCalled();
  });

  it("langsung terbit → publishedAt = sekarang → status tampilan PUBLISHED", async () => {
    const r = await blogService.createPost({ ...base, status: "PUBLISHED" }, null, NOW);
    expect(post.create.mock.calls[0][0].publishedAt).toEqual(NOW);
    expect(r.displayStatus).toBe("PUBLISHED");
  });

  it("terbit dengan tanggal masa depan → TERJADWAL", async () => {
    const r = await blogService.createPost(
      { ...base, status: "PUBLISHED", publishedAt: "2026-10-25T01:00:00.000Z" },
      null,
      NOW
    );
    expect(r.displayStatus).toBe("SCHEDULED");
  });

  it("kategori yang tidak ada ditolak", async () => {
    category.findById.mockResolvedValue(null);
    await expect(blogService.createPost({ ...base, categoryId: "nope" }, null, NOW)).rejects.toBeInstanceOf(ValidationError);
    expect(post.create).not.toHaveBeenCalled();
  });

  it("judul tanpa huruf/angka tetap menghasilkan slug cadangan", async () => {
    await blogService.createPost({ ...base, title: "!!! ???" }, null, NOW);
    expect(post.create.mock.calls[0][0].slug).toBe("artikel");
  });

  it("menerjemahkan pelanggaran unique (balapan) menjadi ConflictError", async () => {
    post.create.mockRejectedValue(Object.assign(new Error("dup"), { code: "P2002" }));
    await expect(blogService.createPost(base, null, NOW)).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("updatePost", () => {
  it("artikel tidak ada → NotFound", async () => {
    post.findById.mockResolvedValue(null);
    await expect(blogService.updatePost("x", { title: "Judul baru" }, NOW)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("hanya menyentuh field yang dikirim", async () => {
    post.findById.mockResolvedValue(row());
    await blogService.updatePost("p1", { title: "Judul baru" }, NOW);
    expect(post.update).toHaveBeenCalledWith("p1", { title: "Judul baru" }, undefined);
  });

  it("mengubah isi menghitung ulang waktu baca", async () => {
    post.findById.mockResolvedValue(row());
    await blogService.updatePost("p1", { content: "kata ".repeat(450) }, NOW);
    expect(post.update.mock.calls[0][1].readingMinutes).toBe(3);
  });

  it("menerbitkan draft: status PUBLISHED + publishedAt sekarang", async () => {
    post.findById.mockResolvedValue(row());
    await blogService.updatePost("p1", { status: "PUBLISHED" }, NOW);
    const d = post.update.mock.calls[0][1];
    expect(d.status).toBe("PUBLISHED");
    expect(d.publishedAt).toEqual(NOW);
  });

  it("menarik ke draft lalu menerbitkan ulang mempertahankan tanggal terbit pertama", async () => {
    const first = new Date("2026-09-01T00:00:00Z");
    post.findById.mockResolvedValue(row({ status: "DRAFT", publishedAt: first }));
    await blogService.updatePost("p1", { status: "PUBLISHED" }, NOW);
    expect(post.update.mock.calls[0][1].publishedAt).toEqual(first);
  });

  it("ganti slug artikel yang PERNAH terbit → slug lama dicatat untuk redirect", async () => {
    post.findById.mockResolvedValue(row({ status: "PUBLISHED", publishedAt: new Date("2026-09-01") }));
    await blogService.updatePost("p1", { slug: "slug-baru" }, NOW);
    expect(post.slugTaken).toHaveBeenCalledWith("slug-baru", "p1");
    expect(post.update).toHaveBeenCalledWith("p1", { slug: "slug-baru" }, {
      add: "tips-tukar-dolar-di-jakarta",
      remove: "slug-baru",
    });
  });

  it("ganti slug draft yang belum pernah terbit → tidak ada redirect yang dicatat", async () => {
    post.findById.mockResolvedValue(row());
    await blogService.updatePost("p1", { slug: "slug-baru" }, NOW);
    expect(post.update.mock.calls[0][2]).toEqual({ add: undefined, remove: "slug-baru" });
  });

  it("slug yang tidak berubah tidak memicu cek bentrok maupun riwayat", async () => {
    post.findById.mockResolvedValue(row());
    await blogService.updatePost("p1", { slug: "tips-tukar-dolar-di-jakarta", title: "Sama saja" }, NOW);
    expect(post.slugTaken).not.toHaveBeenCalled();
    expect(post.update.mock.calls[0][2]).toBeUndefined();
  });

  it("slug baru yang dipakai artikel lain ditolak", async () => {
    post.findById.mockResolvedValue(row());
    post.slugTaken.mockResolvedValue(true);
    await expect(blogService.updatePost("p1", { slug: "dipakai" }, NOW)).rejects.toBeInstanceOf(ConflictError);
    expect(post.update).not.toHaveBeenCalled();
  });

  it("menjadwal ulang artikel terbit lewat publishedAt saja", async () => {
    post.findById.mockResolvedValue(row({ status: "PUBLISHED", publishedAt: new Date("2026-09-01") }));
    await blogService.updatePost("p1", { publishedAt: "2026-11-01T00:00:00.000Z" }, NOW);
    const d = post.update.mock.calls[0][1];
    expect(d.status).toBe("PUBLISHED");
    expect((d.publishedAt as Date).toISOString()).toBe("2026-11-01T00:00:00.000Z");
  });
});

describe("deletePost", () => {
  it("NotFound bila tidak ada, menghapus bila ada", async () => {
    post.findById.mockResolvedValueOnce(null);
    await expect(blogService.deletePost("x")).rejects.toBeInstanceOf(NotFoundError);
    post.findById.mockResolvedValueOnce(row());
    await blogService.deletePost("p1");
    expect(post.delete).toHaveBeenCalledWith("p1");
  });
});

describe("createCategory", () => {
  it("slug dari nama; bentrok → Conflict", async () => {
    category.findBySlug.mockResolvedValueOnce(null);
    category.create.mockImplementation(async (d) => ({ id: "c1", ...d }));
    await blogService.createCategory({ name: "Tips Valas" });
    expect(category.create).toHaveBeenCalledWith({ name: "Tips Valas", slug: "tips-valas", description: null });

    category.findBySlug.mockResolvedValueOnce({ id: "c0" });
    await expect(blogService.createCategory({ name: "Tips Valas" })).rejects.toBeInstanceOf(ConflictError);
  });
  it("nama tanpa huruf/angka ditolak", async () => {
    await expect(blogService.createCategory({ name: "!!" })).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("recordView", () => {
  const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
  const input = { postId: "p1", ip: "1.2.3.4", userAgent: UA, referrer: "https://www.google.com/", ownHosts: ["pusatvalasindo.com"] };

  it("bot tidak dihitung dan tidak menyentuh database", async () => {
    const r = await blogService.recordView({ ...input, userAgent: "Googlebot/2.1" }, NOW);
    expect(r).toBe("bot");
    expect(post.findLiveId).not.toHaveBeenCalled();
  });

  it("artikel yang tidak tayang tidak dihitung", async () => {
    post.findLiveId.mockResolvedValue(null);
    expect(await blogService.recordView(input, NOW)).toBe("not_found");
    expect(view.record).not.toHaveBeenCalled();
  });

  it("kunjungan ulang dalam jendela dedup tidak dihitung", async () => {
    post.findLiveId.mockResolvedValue({ id: "p1" });
    view.hasViewSince.mockResolvedValue(true);
    expect(await blogService.recordView(input, NOW)).toBe("duplicate");
    const since = view.hasViewSince.mock.calls[0][2] as Date;
    expect(NOW.getTime() - since.getTime()).toBe(VIEW_DEDUP_WINDOW_MS);
    expect(view.record).not.toHaveBeenCalled();
  });

  it("kunjungan baru dicatat dengan hash (bukan IP) dan host referrer yang dinormalisasi", async () => {
    post.findLiveId.mockResolvedValue({ id: "p1" });
    view.hasViewSince.mockResolvedValue(false);
    expect(await blogService.recordView(input, NOW)).toBe("counted");
    const [postId, hash, ref, at] = view.record.mock.calls[0];
    expect(postId).toBe("p1");
    expect(hash).toMatch(/^[0-9a-f]{32}$/);
    expect(hash).not.toContain("1.2.3.4");
    expect(ref).toBe("google.com");
    expect(at).toEqual(NOW);
  });
});

describe("listLivePostsByCategory", () => {
  const cat = { id: "c1", slug: "kurs", name: "Kurs", description: null, updatedAt: NOW, _count: { posts: 13 } };
  beforeEach(() => {
    post.findLiveCategoryBySlug.mockReset();
    post.countLive.mockReset();
    post.listLive.mockReset();
  });

  it("mengembalikan null untuk slug yang tidak ada atau kategori tanpa artikel tayang", async () => {
    post.findLiveCategoryBySlug.mockResolvedValue(null);
    expect(await blogService.listLivePostsByCategory("hantu", 1, NOW)).toBeNull();
    expect(post.countLive).not.toHaveBeenCalled();
  });

  it("memfilter hitungan & daftar dengan id kategori", async () => {
    post.findLiveCategoryBySlug.mockResolvedValue(cat);
    post.countLive.mockResolvedValue(13);
    post.listLive.mockResolvedValue([{ id: "p1" }]);

    const res = await blogService.listLivePostsByCategory("kurs", 1, NOW);

    expect(post.countLive).toHaveBeenCalledWith(NOW, "c1");
    expect(post.listLive).toHaveBeenCalledWith({ limit: 12, offset: 0, categoryId: "c1", now: NOW });
    expect(res).toMatchObject({ category: cat, total: 13, page: 1, totalPages: 2 });
  });

  it("menjepit halaman di luar rentang ke halaman terakhir", async () => {
    post.findLiveCategoryBySlug.mockResolvedValue(cat);
    post.countLive.mockResolvedValue(13);
    post.listLive.mockResolvedValue([]);

    const res = await blogService.listLivePostsByCategory("kurs", 99, NOW);

    expect(res?.page).toBe(2);
    expect(post.listLive).toHaveBeenCalledWith(expect.objectContaining({ offset: 12 }));
  });
});
