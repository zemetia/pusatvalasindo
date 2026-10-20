import { beforeEach, describe, expect, it, vi } from "vitest";

const { svc } = vi.hoisted(() => ({
  svc: {
    listPosts: vi.fn(),
    getPost: vi.fn(),
    getPostBySlug: vi.fn(),
    createPost: vi.fn(),
    updatePost: vi.fn(),
    deletePost: vi.fn(),
    listCategories: vi.fn(),
    createCategory: vi.fn(),
    getOverview: vi.fn(),
    getPostAnalytics: vi.fn(),
  },
}));
vi.mock("@/backend/services/blog.service", () => ({ blogService: svc }));

import { BLOG_TOOLS, assertBlogAccess } from "./blog-tools";
import { ForbiddenError, ValidationError } from "@/backend/errors/app-error";
import type { McpCaller } from "@/backend/mcp/auth";

const owner = { id: "mcp:owner", companyId: null, branchId: null, roleName: "OWNER", permissions: [], payrollCompanyIds: [], companyCode: null, label: "owner" } as McpCaller;
const tool = (name: string) => {
  const t = BLOG_TOOLS.find((x) => x.name === name);
  if (!t) throw new Error(`tool ${name} missing`);
  return t;
};

beforeEach(() => vi.clearAllMocks());

describe("assertBlogAccess", () => {
  it("menerima key owner global", () => {
    expect(() => assertBlogAccess(owner)).not.toThrow();
  });
  it("menolak key yang dibatasi PT, walau namanya jabatan global", () => {
    expect(() => assertBlogAccess({ ...owner, companyId: "pt1" })).toThrow(ForbiddenError);
  });
  it("menolak jabatan non-global", () => {
    expect(() => assertBlogAccess({ ...owner, roleName: "KASIR" })).toThrow(ForbiddenError);
    expect(() => assertBlogAccess({ ...owner, roleName: "Kepala Cabang", companyId: "pt1" })).toThrow(ForbiddenError);
  });
});

describe("katalog tool", () => {
  it("nama unik dan semuanya berawalan get_/create_/update_/set_/delete_", () => {
    const names = BLOG_TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names.every((n) => /^(get|create|update|set|delete)_blog_/.test(n))).toBe(true);
    expect(names).toEqual(
      expect.arrayContaining([
        "get_blog_posts",
        "get_blog_post",
        "create_blog_post",
        "update_blog_post",
        "set_blog_post_status",
        "delete_blog_post",
        "get_blog_categories",
        "create_blog_category",
        "get_blog_analytics",
      ])
    );
  });
});

describe("create_blog_post", () => {
  const args = {
    title: "Tips Tukar Dolar",
    excerpt: "Ringkasan artikel yang cukup panjang.",
    content: "## Isi\n\nTeks.",
    cover_image_url: "https://cdn.example.com/a.jpg",
    meta_title: "Judul SEO",
    category_id: "c1",
  };

  it("memetakan snake_case → camelCase, memvalidasi, dan membuat TANPA penulis (null)", async () => {
    svc.createPost.mockResolvedValue({ id: "p1", slug: "tips-tukar-dolar", displayStatus: "DRAFT" });
    const res = (await tool("create_blog_post").handler(args, owner)) as { url: string };
    expect(svc.createPost).toHaveBeenCalledTimes(1);
    const [input, authorId] = svc.createPost.mock.calls[0];
    expect(authorId).toBeNull();
    expect(input).toMatchObject({
      title: "Tips Tukar Dolar",
      coverImageUrl: "https://cdn.example.com/a.jpg",
      metaTitle: "Judul SEO",
      categoryId: "c1",
    });
    expect(input.status).toBeUndefined(); // service yang memutuskan default DRAFT
    expect(res.url).toMatch(/\/blog\/tips-tukar-dolar$/);
  });

  it("input tidak valid → ValidationError dengan nama field, service tidak dipanggil", async () => {
    await expect(tool("create_blog_post").handler({ ...args, title: "x" }, owner)).rejects.toThrow(/title/);
    await expect(
      tool("create_blog_post").handler({ ...args, cover_image_url: "http://insecure.example.com/a.jpg" }, owner)
    ).rejects.toBeInstanceOf(ValidationError);
    expect(svc.createPost).not.toHaveBeenCalled();
  });
});

describe("update_blog_post / set_blog_post_status", () => {
  it("update: hanya field yang dikirim diteruskan", async () => {
    svc.updatePost.mockResolvedValue({ id: "p1", slug: "s" });
    await tool("update_blog_post").handler({ id: "p1", title: "Judul baru" }, owner);
    expect(svc.updatePost).toHaveBeenCalledWith("p1", { title: "Judul baru" });
  });
  it("update tanpa id ditolak", async () => {
    await expect(tool("update_blog_post").handler({ title: "Judul baru" }, owner)).rejects.toBeInstanceOf(ValidationError);
  });
  it("set status: teruskan status & published_at saja", async () => {
    svc.updatePost.mockResolvedValue({ id: "p1", slug: "s", displayStatus: "SCHEDULED", publishedAt: null });
    await tool("set_blog_post_status").handler(
      { id: "p1", status: "PUBLISHED", published_at: "2026-11-01T08:00:00+07:00", title: "diabaikan" },
      owner
    );
    expect(svc.updatePost).toHaveBeenCalledWith("p1", { status: "PUBLISHED", publishedAt: "2026-11-01T08:00:00+07:00" });
  });
  it("status di luar DRAFT/PUBLISHED/ARCHIVED ditolak", async () => {
    await expect(tool("set_blog_post_status").handler({ id: "p1", status: "SCHEDULED" }, owner)).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("delete_blog_post", () => {
  it("wajib confirm=true", async () => {
    await expect(tool("delete_blog_post").handler({ id: "p1" }, owner)).rejects.toBeInstanceOf(ValidationError);
    await expect(tool("delete_blog_post").handler({ id: "p1", confirm: false }, owner)).rejects.toBeInstanceOf(ValidationError);
    expect(svc.deletePost).not.toHaveBeenCalled();
    await tool("delete_blog_post").handler({ id: "p1", confirm: true }, owner);
    expect(svc.deletePost).toHaveBeenCalledWith("p1");
  });
});

describe("get_blog_post & analytics", () => {
  it("get_blog_post butuh id atau slug", async () => {
    await expect(tool("get_blog_post").handler({}, owner)).rejects.toBeInstanceOf(ValidationError);
    svc.getPostBySlug.mockResolvedValue({ id: "p1", slug: "s", content: "isi" });
    const r = (await tool("get_blog_post").handler({ slug: "s" }, owner)) as { content: string };
    expect(r.content).toBe("isi");
  });
  it("get_blog_analytics: tanpa post_id → ringkasan, dengan post_id → per artikel; days di-normalisasi", async () => {
    svc.getOverview.mockResolvedValue({ ok: 1 });
    svc.getPostAnalytics.mockResolvedValue({ ok: 2 });
    await tool("get_blog_analytics").handler({ days: 15 }, owner);
    expect(svc.getOverview).toHaveBeenCalledWith(30);
    await tool("get_blog_analytics").handler({ days: 7, post_id: "p1" }, owner);
    expect(svc.getPostAnalytics).toHaveBeenCalledWith("p1", 7);
  });
  it("get_blog_posts membatasi limit dan menormalkan filter", async () => {
    svc.listPosts.mockResolvedValue({ items: [], total: 0 });
    await tool("get_blog_posts").handler({ limit: 9999, status: "DRAFT", days: 90 }, owner);
    expect(svc.listPosts).toHaveBeenCalledWith(expect.objectContaining({ limit: 100, status: "DRAFT", days: 90, offset: 0 }));
    await expect(tool("get_blog_posts").handler({ status: "BOGUS" }, owner)).rejects.toBeInstanceOf(ValidationError);
  });
});
