import { z, type ZodRawShape } from "zod";
import { ForbiddenError, ValidationError } from "@/backend/errors/app-error";
import type { McpCaller } from "@/backend/mcp/auth";
import { blogService } from "@/backend/services/blog.service";
import { siteConfig } from "@/config/site";
import { parseRangeDays } from "@/lib/blog/analytics-range";
import { DISPLAY_STATUSES } from "@/lib/blog/status";
import { isGlobalRole } from "@/lib/permissions";
import {
  blogStatusSchema,
  createBlogCategorySchema,
  createBlogPostSchema,
  updateBlogPostSchema,
} from "@/lib/validations/blog";

/**
 * Tool blog untuk agen. Semuanya lewat blog.service — validasi, slug otomatis,
 * jadwal, redirect slug lama, dan revalidasi cache situs sama persis dengan
 * dashboard; tidak ada SQL mentah dan tidak ada jalan pintas.
 *
 * Wewenang: blog adalah resource GLOBAL tanpa peta legacy (lihat authz/resources.ts),
 * jadi hanya key global (Owner/Super Admin) yang boleh — pola yang sama dengan
 * `run_read_query`. Key per-PT di masa depan otomatis ditolak di sini.
 *
 * Artikel yang dibuat lewat MCP tidak punya penulis (`authorId` null): key MCP
 * bukan akun pengguna, jadi tidak ada baris `user` yang bisa dirujuk.
 */

export type BlogTool = {
  name: string;
  description: string;
  inputSchema: ZodRawShape;
  handler: (args: Record<string, unknown>, caller: McpCaller) => Promise<unknown>;
};

/** Gerbang tunggal untuk semua tool blog. */
export function assertBlogAccess(caller: McpCaller): void {
  if (!isGlobalRole(caller.roleName) || caller.companyId !== null) {
    throw new ForbiddenError("Tool blog hanya untuk key global (Super Admin/Owner)");
  }
}

const postUrl = (slug: string) => `${siteConfig.url}/blog/${slug}`;

/** Memetakan argumen snake_case MCP ke bentuk camelCase yang dipahami skema validasi dashboard. */
function postArgs(args: Record<string, unknown>): Record<string, unknown> {
  const map: Record<string, string> = {
    title: "title",
    slug: "slug",
    excerpt: "excerpt",
    content: "content",
    cover_image_url: "coverImageUrl",
    cover_image_alt: "coverImageAlt",
    meta_title: "metaTitle",
    meta_description: "metaDescription",
    category_id: "categoryId",
    status: "status",
    published_at: "publishedAt",
  };
  const out: Record<string, unknown> = {};
  for (const [snake, camel] of Object.entries(map)) {
    if (args[snake] !== undefined) out[camel] = args[snake];
  }
  return out;
}

/** Zod → ValidationError dengan pesan field pertama, seperti withValidation di API. */
function parse<S extends z.ZodTypeAny>(schema: S, value: unknown): z.output<S> {
  const r = schema.safeParse(value);
  if (!r.success) {
    const issue = r.error.errors[0];
    throw new ValidationError(
      issue ? `${issue.path.join(".") || "input"}: ${issue.message}` : "Validation failed"
    );
  }
  return r.data;
}

function requireId(args: Record<string, unknown>): string {
  const id = args.id;
  if (typeof id !== "string" || !id) throw new ValidationError("Missing required argument: id");
  return id;
}

const FIELD = {
  title: z.string().describe("Judul artikel, 3–160 karakter."),
  slug: z
    .string()
    .describe("Opsional. Huruf kecil/angka/tanda hubung. Kosong = dibuat otomatis dari judul."),
  excerpt: z.string().describe("Ringkasan 10–320 karakter; tampil di kartu & jadi meta description cadangan."),
  content: z
    .string()
    .describe(
      "Isi artikel dalam Markdown (heading ##, daftar, tabel, tautan). HTML mentah tidak dirender. Mulai dari ## — judul sudah menjadi H1."
    ),
  cover_image_url: z.string().nullable().describe("https://… atau path /images/… ; null untuk menghapus."),
  cover_image_alt: z.string().nullable(),
  meta_title: z.string().nullable().describe("Judul SEO, maks 70 karakter."),
  meta_description: z.string().nullable().describe("Deskripsi SEO, maks 170 karakter (ideal ≤ 160)."),
  category_id: z.string().nullable().describe("id dari get_blog_categories; null = tanpa kategori."),
  status: blogStatusSchema.describe("DRAFT | PUBLISHED | ARCHIVED."),
  published_at: z
    .string()
    .nullable()
    .describe(
      "ISO-8601 dengan zona waktu, mis. 2026-11-01T08:00:00+07:00. Dengan status PUBLISHED dan tanggal masa depan artikel TERJADWAL."
    ),
};

const postFields = (required: boolean): ZodRawShape => {
  const base = {
    title: FIELD.title,
    excerpt: FIELD.excerpt,
    content: FIELD.content,
  };
  const optional = {
    slug: FIELD.slug.optional(),
    cover_image_url: FIELD.cover_image_url.optional(),
    cover_image_alt: FIELD.cover_image_alt.optional(),
    meta_title: FIELD.meta_title.optional(),
    meta_description: FIELD.meta_description.optional(),
    category_id: FIELD.category_id.optional(),
    status: FIELD.status.optional(),
    published_at: FIELD.published_at.optional(),
  };
  return required
    ? { ...base, ...optional }
    : {
        title: base.title.optional(),
        excerpt: base.excerpt.optional(),
        content: base.content.optional(),
        ...optional,
      };
};

export const BLOG_TOOLS: BlogTool[] = [
  {
    name: "get_blog_posts",
    description:
      "List blog posts (without body) with status (DRAFT / SCHEDULED / PUBLISHED / ARCHIVED), category, total views and views/visitors in the last `days` days. Newest-updated first. Use get_blog_post for the full Markdown.",
    inputSchema: {
      status: z.enum(["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"]).optional(),
      search: z.string().optional().describe("Substring of title / slug / excerpt."),
      category_id: z.string().optional().describe('Category id, or "none" for uncategorised posts.'),
      days: z.number().int().optional().describe("Window for the views columns: 7, 30 (default) or 90."),
      limit: z.number().int().positive().optional().describe("Max rows (default 20, max 100)."),
      offset: z.number().int().min(0).optional(),
    },
    handler: async (args) => {
      const status = args.status as (typeof DISPLAY_STATUSES)[number] | undefined;
      if (status && !DISPLAY_STATUSES.includes(status)) throw new ValidationError("Invalid status");
      const limit = Math.min(Math.max(Number(args.limit) || 20, 1), 100);
      const { items, total } = await blogService.listPosts({
        status,
        search: typeof args.search === "string" ? args.search : undefined,
        categoryId: typeof args.category_id === "string" ? args.category_id : undefined,
        days: parseRangeDays(args.days),
        limit,
        offset: Math.max(Number(args.offset) || 0, 0),
      });
      return {
        total,
        items: items.map((p) => ({
          id: p.id,
          slug: p.slug,
          url: postUrl(p.slug),
          title: p.title,
          excerpt: p.excerpt,
          status: p.displayStatus,
          published_at: p.publishedAt,
          updated_at: p.updatedAt,
          category: p.category,
          reading_minutes: p.readingMinutes,
          total_views: p.viewCount,
          range_views: p.rangeViews,
          range_visitors: p.rangeVisitors,
        })),
      };
    },
  },
  {
    name: "get_blog_post",
    description: "Get one blog post INCLUDING its full Markdown body, by id or slug.",
    inputSchema: {
      id: z.string().optional().describe("Post id (from get_blog_posts)."),
      slug: z.string().optional().describe("Post slug. One of id / slug is required."),
    },
    handler: async (args) => {
      const post =
        typeof args.id === "string" && args.id
          ? await blogService.getPost(args.id)
          : typeof args.slug === "string" && args.slug
            ? await blogService.getPostBySlug(args.slug)
            : null;
      if (!post) throw new ValidationError("Provide id or slug");
      return { ...post, url: postUrl(post.slug) };
    },
  },
  {
    name: "create_blog_post",
    description:
      "Create a blog post. Defaults to DRAFT — only pass status PUBLISHED when the owner explicitly asked to publish (it goes live on the public site immediately, or at published_at if that is in the future). Slug is generated from the title when omitted. Returns the saved post and its public URL.",
    inputSchema: postFields(true),
    handler: async (args) => {
      const input = parse(createBlogPostSchema, postArgs(args));
      const post = await blogService.createPost(input, null);
      return { ...post, url: postUrl(post.slug) };
    },
  },
  {
    name: "update_blog_post",
    description:
      "Update fields of a blog post by id; only the fields you pass change. Changing the slug of a post that was already published keeps the old URL working via a 301 redirect. Can also reschedule via published_at.",
    inputSchema: { id: z.string().describe("Post id"), ...postFields(false) },
    handler: async (args) => {
      const id = requireId(args);
      const input = parse(updateBlogPostSchema, postArgs(args));
      const post = await blogService.updatePost(id, input);
      return { ...post, url: postUrl(post.slug) };
    },
  },
  {
    name: "set_blog_post_status",
    description:
      "Publish, unpublish (back to DRAFT) or archive a post. PUBLISHED without published_at goes live now (or keeps the original publish date if it was published before); with a future published_at it is SCHEDULED.",
    inputSchema: {
      id: z.string().describe("Post id"),
      status: blogStatusSchema,
      published_at: FIELD.published_at.optional(),
    },
    handler: async (args) => {
      const id = requireId(args);
      const input = parse(updateBlogPostSchema, postArgs({ status: args.status, published_at: args.published_at }));
      if (input.status === "PUBLISHED" && input.publishedAt === undefined) {
        // Tanggal lama yang tersisa di masa depan (jadwal yang dibatalkan, atau artikel
        // terjadwal) tidak boleh membuat "terbitkan" diam-diam menjadi terjadwal.
        const existing = await blogService.getPost(id);
        if (existing.publishedAt && existing.publishedAt.getTime() > Date.now()) {
          input.publishedAt = new Date().toISOString();
        }
      }
      const post = await blogService.updatePost(id, input);
      return { id: post.id, slug: post.slug, url: postUrl(post.slug), status: post.displayStatus, published_at: post.publishedAt };
    },
  },
  {
    name: "delete_blog_post",
    description:
      "PERMANENTLY delete a blog post and its view history. Cannot be undone — prefer set_blog_post_status ARCHIVED unless the owner explicitly asked to delete. Requires confirm=true.",
    inputSchema: {
      id: z.string().describe("Post id"),
      confirm: z.literal(true).describe("Must be true."),
    },
    handler: async (args) => {
      if (args.confirm !== true) throw new ValidationError("confirm must be true");
      const id = requireId(args);
      await blogService.deletePost(id);
      return { deleted: true, id };
    },
  },
  {
    name: "get_blog_categories",
    description: "List blog categories with the number of posts in each.",
    inputSchema: {},
    handler: async () => {
      const rows = await blogService.listCategories();
      return rows.map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        description: c.description,
        post_count: c._count.posts,
      }));
    },
  },
  {
    name: "create_blog_category",
    description: "Create a blog category. Slug is generated from the name when omitted.",
    inputSchema: {
      name: z.string().describe("2–60 characters."),
      slug: z.string().optional(),
      description: z.string().nullable().optional().describe("Max 200 characters."),
    },
    handler: async (args) => {
      const input = parse(createBlogCategorySchema, {
        name: args.name,
        ...(args.slug !== undefined ? { slug: args.slug } : {}),
        ...(args.description !== undefined ? { description: args.description } : {}),
      });
      const c = await blogService.createCategory(input);
      return { id: c.id, slug: c.slug, name: c.name, description: c.description, post_count: c._count.posts };
    },
  },
  {
    name: "get_blog_analytics",
    description:
      "Blog traffic analytics for the last `days` days (7, 30 default, 90; WIB days): total views, visitors (unique per day) with % change vs the previous equal period, daily series, top posts, traffic sources (referrer host; null = direct) and post counts by status. Pass post_id for a single post. Bots and repeat views within 30 minutes are excluded.",
    inputSchema: {
      days: z.number().int().optional().describe("7, 30 (default) or 90."),
      post_id: z.string().optional().describe("Restrict to one post."),
    },
    handler: async (args) => {
      const days = parseRangeDays(args.days);
      if (typeof args.post_id === "string" && args.post_id) {
        return blogService.getPostAnalytics(args.post_id, days);
      }
      return blogService.getOverview(days);
    },
  },
];
