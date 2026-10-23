import { revalidatePath } from "next/cache";
import { ConflictError, NotFoundError, ValidationError } from "@/backend/errors/app-error";
import {
  blogPostRepository,
  type BlogListParams,
  type BlogLiveCategoryRow,
  type BlogPostFull,
  type BlogPostListRow,
  type BlogPostPublicRow,
} from "@/backend/repositories/blog-post.repository";
import {
  blogCategoryRepository,
  type BlogCategoryRow,
} from "@/backend/repositories/blog-category.repository";
import { blogViewRepository } from "@/backend/repositories/blog-view.repository";
import { blogVoteRepository, type VoteStatus } from "@/backend/repositories/blog-vote.repository";
import type { ReferrerRow, TopPostRow } from "@/backend/repositories/blog-analytics.queries";
import type { Prisma } from "@src/generated/prisma/client";
import { readingMinutes } from "@/lib/blog/content";
import { SLUG_MAX, slugify } from "@/lib/blog/slug";
import { displayStatus, type BlogDisplayStatus, type BlogStoredStatus } from "@/lib/blog/status";
import { isBotUserAgent, jakartaDay, normalizeReferrerHost, visitorHash } from "@/lib/blog/tracking";
import {
  fillDailySeries,
  pctChange,
  resolveRange,
  type DailyPoint,
} from "@/lib/blog/analytics-range";
import type {
  CreateBlogCategoryInput,
  CreateBlogPostInput,
  UpdateBlogCategoryInput,
  UpdateBlogPostInput,
} from "@/lib/validations/blog";

/** Tampilan dari pengunjung yang sama dalam jendela ini dihitung satu kali (refresh/back tidak menggelembungkan angka). */
export const VIEW_DEDUP_WINDOW_MS = 30 * 60_000;
export const PUBLIC_PAGE_SIZE = 12;

/**
 * Menyegarkan semua halaman publik yang bergantung pada blog. Dibungkus
 * try/catch karena `revalidatePath` melempar di luar konteks request Next.js
 * (mis. skrip atau tes) — kegagalan menyegarkan cache tidak boleh menggagalkan
 * penyimpanan artikelnya.
 */
function revalidateBlog(): void {
  try {
    revalidatePath("/[locale]", "page");
    revalidatePath("/[locale]/blog", "page");
    revalidatePath("/[locale]/blog/kategori/[slug]", "page");
    revalidatePath("/[locale]/blog/[slug]", "page");
    revalidatePath("/sitemap.xml");
    revalidatePath("/feed.xml");
    revalidatePath("/llms.txt");
    revalidatePath("/llms-full.txt");
  } catch (e) {
    console.warn("[blog] revalidate dilewati:", e instanceof Error ? e.message : e);
  }
}

function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: unknown }).code === "P2002";
}

/** Slug otomatis dari judul; bila bentrok, tambahkan -2, -3, … sampai bebas. */
async function freeSlug(base: string, excludePostId?: string): Promise<string> {
  const root = base || "artikel";
  let candidate = root;
  for (let n = 2; n <= 100; n++) {
    if (!(await blogPostRepository.slugTaken(candidate, excludePostId))) return candidate;
    const suffix = `-${n}`;
    candidate = `${root.slice(0, SLUG_MAX - suffix.length).replace(/-+$/, "")}${suffix}`;
  }
  throw new ConflictError("Tidak menemukan slug yang tersedia — ubah judul atau isi slug manual");
}

/** Slug yang diminta eksplisit tidak boleh diam-diam diubah: bentrok = error. */
async function assertSlugFree(slug: string, excludePostId?: string): Promise<void> {
  if (await blogPostRepository.slugTaken(slug, excludePostId)) {
    throw new ConflictError(`Slug "${slug}" sudah dipakai artikel lain`);
  }
}

async function assertCategoryExists(categoryId: string | null | undefined): Promise<void> {
  if (!categoryId) return;
  if (!(await blogCategoryRepository.findById(categoryId))) {
    throw new ValidationError("Kategori tidak ditemukan");
  }
}

/**
 * Menentukan `publishedAt` yang disimpan.
 *  • tanggal diminta eksplisit → pakai itu (jadwal / backdate),
 *  • diminta dikosongkan → null, kecuali sedang diterbitkan (artikel terbit wajib bertanggal),
 *  • tidak disebut → pertahankan yang lama, supaya menarik lalu menerbitkan ulang
 *    tidak mengubah `datePublished` yang sudah dilihat mesin pencari.
 */
export function resolvePublishedAt(
  nextStatus: BlogStoredStatus,
  requested: string | null | undefined,
  existing: Date | null,
  now: Date
): Date | null {
  if (typeof requested === "string") return new Date(requested);
  if (requested === null) return nextStatus === "PUBLISHED" ? now : null;
  if (existing) return existing;
  return nextStatus === "PUBLISHED" ? now : null;
}

export type BlogPostWithStatus<T extends { status: BlogStoredStatus; publishedAt: Date | null }> = T & {
  displayStatus: BlogDisplayStatus;
};

function withStatus<T extends { status: BlogStoredStatus; publishedAt: Date | null }>(
  post: T,
  now: Date
): BlogPostWithStatus<T> {
  return { ...post, displayStatus: displayStatus(post, now) };
}

export type BlogPostRow = BlogPostWithStatus<BlogPostListRow> & {
  /** Tampilan & pengunjung dalam rentang yang diminta. */
  rangeViews: number;
  rangeVisitors: number;
};

export type BlogOverview = {
  days: number;
  from: Date;
  to: Date;
  views: number;
  visitors: number;
  prevViews: number;
  prevVisitors: number;
  viewsDelta: number | null;
  visitorsDelta: number | null;
  allTimeViews: number;
  daily: DailyPoint[];
  topPosts: TopPostRow[];
  referrers: ReferrerRow[];
  counts: Record<BlogDisplayStatus, number>;
};

export const blogService = {
  // ── Artikel (admin) ──────────────────────────────────────────────────────
  async listPosts(
    params: BlogListParams & { days?: number }
  ): Promise<{ items: BlogPostRow[]; total: number }> {
    const now = params.now ?? new Date();
    const range = resolveRange(params.days ?? 30, now);
    const [rows, total, viewsMap] = await Promise.all([
      blogPostRepository.list({ ...params, now }),
      blogPostRepository.count({ ...params, now }),
      blogViewRepository.viewsByPost(range.from, range.to),
    ]);
    const items = rows.map((r) => ({
      ...withStatus(r, now),
      rangeViews: viewsMap.get(r.id)?.views ?? 0,
      rangeVisitors: viewsMap.get(r.id)?.visitors ?? 0,
    }));
    return { items, total };
  },

  async getPost(id: string): Promise<BlogPostWithStatus<BlogPostFull>> {
    const post = await blogPostRepository.findById(id);
    if (!post) throw new NotFoundError("Artikel tidak ditemukan");
    return withStatus(post, new Date());
  },

  async getPostBySlug(slug: string): Promise<BlogPostWithStatus<BlogPostFull>> {
    const post = await blogPostRepository.findBySlug(slug);
    if (!post) throw new NotFoundError("Artikel tidak ditemukan");
    return withStatus(post, new Date());
  },

  /** `authorId` null untuk artikel yang dibuat lewat MCP (key-nya bukan akun pengguna). */
  async createPost(
    input: CreateBlogPostInput,
    authorId: string | null,
    now: Date = new Date()
  ): Promise<BlogPostWithStatus<BlogPostFull>> {
    await assertCategoryExists(input.categoryId);

    let slug: string;
    if (input.slug) {
      await assertSlugFree(input.slug);
      slug = input.slug;
    } else {
      slug = await freeSlug(slugify(input.title));
    }

    const status: BlogStoredStatus = input.status ?? "DRAFT";
    try {
      const post = await blogPostRepository.create({
        slug,
        title: input.title,
        excerpt: input.excerpt,
        content: input.content,
        coverImageUrl: input.coverImageUrl ?? null,
        coverImageAlt: input.coverImageAlt ?? null,
        metaTitle: input.metaTitle ?? null,
        metaDescription: input.metaDescription ?? null,
        categoryId: input.categoryId ?? null,
        authorId,
        status,
        publishedAt: resolvePublishedAt(status, input.publishedAt, null, now),
        readingMinutes: readingMinutes(input.content),
      });
      revalidateBlog();
      return withStatus(post, now);
    } catch (e) {
      if (isUniqueViolation(e)) throw new ConflictError(`Slug "${slug}" sudah dipakai artikel lain`);
      throw e;
    }
  },

  async updatePost(
    id: string,
    input: UpdateBlogPostInput,
    now: Date = new Date()
  ): Promise<BlogPostWithStatus<BlogPostFull>> {
    const existing = await blogPostRepository.findById(id);
    if (!existing) throw new NotFoundError("Artikel tidak ditemukan");

    const data: Prisma.BlogPostUncheckedUpdateInput = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.excerpt !== undefined) data.excerpt = input.excerpt;
    if (input.content !== undefined) {
      data.content = input.content;
      data.readingMinutes = readingMinutes(input.content);
    }
    if (input.coverImageUrl !== undefined) data.coverImageUrl = input.coverImageUrl;
    if (input.coverImageAlt !== undefined) data.coverImageAlt = input.coverImageAlt;
    if (input.metaTitle !== undefined) data.metaTitle = input.metaTitle;
    if (input.metaDescription !== undefined) data.metaDescription = input.metaDescription;
    if (input.categoryId !== undefined) {
      await assertCategoryExists(input.categoryId);
      data.categoryId = input.categoryId;
    }

    let slugHistory: { add?: string; remove?: string } | undefined;
    if (input.slug !== undefined && input.slug !== existing.slug) {
      await assertSlugFree(input.slug, id);
      data.slug = input.slug;
      slugHistory = {
        // URL lama hanya perlu diarahkan kalau artikelnya pernah tayang.
        add: existing.publishedAt ? existing.slug : undefined,
        // Kembali ke slug yang pernah dipakai → bukan lagi "lama".
        remove: input.slug,
      };
    }

    if (input.status !== undefined || input.publishedAt !== undefined) {
      const nextStatus: BlogStoredStatus = input.status ?? existing.status;
      data.status = nextStatus;
      data.publishedAt = resolvePublishedAt(nextStatus, input.publishedAt, existing.publishedAt, now);
    }

    try {
      const post = await blogPostRepository.update(id, data, slugHistory);
      revalidateBlog();
      return withStatus(post, now);
    } catch (e) {
      if (isUniqueViolation(e)) throw new ConflictError("Slug sudah dipakai artikel lain");
      throw e;
    }
  },

  async deletePost(id: string): Promise<void> {
    const existing = await blogPostRepository.findById(id);
    if (!existing) throw new NotFoundError("Artikel tidak ditemukan");
    await blogPostRepository.delete(id);
    revalidateBlog();
  },

  // ── Kategori ─────────────────────────────────────────────────────────────
  listCategories(): Promise<BlogCategoryRow[]> {
    return blogCategoryRepository.list();
  },

  async createCategory(input: CreateBlogCategoryInput): Promise<BlogCategoryRow> {
    const slug = input.slug ?? slugify(input.name);
    if (!slug) throw new ValidationError("Nama kategori harus mengandung huruf atau angka");
    if (await blogCategoryRepository.findBySlug(slug)) {
      throw new ConflictError(`Slug kategori "${slug}" sudah dipakai`);
    }
    try {
      const created = await blogCategoryRepository.create({
        name: input.name,
        slug,
        description: input.description ?? null,
      });
      revalidateBlog();
      return created;
    } catch (e) {
      if (isUniqueViolation(e)) throw new ConflictError(`Slug kategori "${slug}" sudah dipakai`);
      throw e;
    }
  },

  async updateCategory(id: string, input: UpdateBlogCategoryInput): Promise<BlogCategoryRow> {
    const existing = await blogCategoryRepository.findById(id);
    if (!existing) throw new NotFoundError("Kategori tidak ditemukan");
    if (input.slug !== undefined && input.slug !== existing.slug) {
      if (await blogCategoryRepository.findBySlug(input.slug)) {
        throw new ConflictError(`Slug kategori "${input.slug}" sudah dipakai`);
      }
    }
    try {
      const updated = await blogCategoryRepository.update(id, {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
      });
      revalidateBlog();
      return updated;
    } catch (e) {
      if (isUniqueViolation(e)) throw new ConflictError("Slug kategori sudah dipakai");
      throw e;
    }
  },

  /** Artikel di kategori ini tidak ikut terhapus — kategorinya saja yang dikosongkan (SetNull). */
  async deleteCategory(id: string): Promise<void> {
    const existing = await blogCategoryRepository.findById(id);
    if (!existing) throw new NotFoundError("Kategori tidak ditemukan");
    await blogCategoryRepository.delete(id);
    revalidateBlog();
  },

  // ── Analitik ─────────────────────────────────────────────────────────────
  async getOverview(days: number, now: Date = new Date()): Promise<BlogOverview> {
    const r = resolveRange(days, now);
    const [cur, prev, daily, topPosts, referrers, counts, allTimeViews] = await Promise.all([
      blogViewRepository.totals(r.from, r.to),
      blogViewRepository.totals(r.prevFrom, r.prevTo),
      blogViewRepository.daily(r.from, r.to),
      blogViewRepository.topPosts(r.from, r.to, 10),
      blogViewRepository.referrers(r.from, r.to, 8),
      blogPostRepository.countByDisplayStatus(now),
      blogPostRepository.sumViews(),
    ]);
    return {
      days: r.days,
      from: r.from,
      to: r.to,
      views: cur.views,
      visitors: cur.visitors,
      prevViews: prev.views,
      prevVisitors: prev.visitors,
      viewsDelta: pctChange(cur.views, prev.views),
      visitorsDelta: pctChange(cur.visitors, prev.visitors),
      allTimeViews,
      daily: fillDailySeries(daily, r.from, r.days),
      topPosts,
      referrers,
      counts,
    };
  },

  async getPostAnalytics(id: string, days: number, now: Date = new Date()) {
    const post = await blogPostRepository.findById(id);
    if (!post) throw new NotFoundError("Artikel tidak ditemukan");
    const r = resolveRange(days, now);
    const [cur, prev, daily, referrers] = await Promise.all([
      blogViewRepository.totals(r.from, r.to, id),
      blogViewRepository.totals(r.prevFrom, r.prevTo, id),
      blogViewRepository.daily(r.from, r.to, id),
      blogViewRepository.referrers(r.from, r.to, 8, id),
    ]);
    return {
      days: r.days,
      views: cur.views,
      visitors: cur.visitors,
      prevViews: prev.views,
      viewsDelta: pctChange(cur.views, prev.views),
      allTimeViews: post.viewCount,
      daily: fillDailySeries(daily, r.from, r.days),
      referrers,
    };
  },

  // ── Publik ───────────────────────────────────────────────────────────────
  async getLivePost(slug: string, now: Date = new Date()): Promise<BlogPostFull | null> {
    return blogPostRepository.findLiveBySlug(slug, now);
  },

  resolveRedirect(oldSlug: string, now: Date = new Date()): Promise<string | null> {
    return blogPostRepository.findRedirectTarget(oldSlug, now);
  },

  async listLivePosts(
    page: number,
    now: Date = new Date(),
    categoryId?: string
  ): Promise<{ items: BlogPostPublicRow[]; total: number; page: number; totalPages: number }> {
    const total = await blogPostRepository.countLive(now, categoryId);
    const totalPages = Math.max(1, Math.ceil(total / PUBLIC_PAGE_SIZE));
    const safePage = Math.min(Math.max(1, Math.floor(page) || 1), totalPages);
    const items = await blogPostRepository.listLive({
      limit: PUBLIC_PAGE_SIZE,
      offset: (safePage - 1) * PUBLIC_PAGE_SIZE,
      categoryId,
      now,
    });
    return { items, total, page: safePage, totalPages };
  },

  /** Kategori yang punya artikel tayang — untuk navigasi kategori & sitemap. */
  listLiveCategories(now: Date = new Date()): Promise<BlogLiveCategoryRow[]> {
    return blogPostRepository.listLiveCategories(now);
  },

  /**
   * Halaman kategori publik. `null` bila slug tidak ada atau kategorinya belum punya
   * artikel tayang — halaman kosong = thin content, jadi diperlakukan 404.
   */
  async listLivePostsByCategory(
    slug: string,
    page: number,
    now: Date = new Date()
  ): Promise<{
    category: BlogLiveCategoryRow;
    items: BlogPostPublicRow[];
    total: number;
    page: number;
    totalPages: number;
  } | null> {
    const category = await blogPostRepository.findLiveCategoryBySlug(slug, now);
    if (!category) return null;
    return { category, ...(await blogService.listLivePosts(page, now, category.id)) };
  },

  listRecentPosts(limit = 5, now: Date = new Date()): Promise<BlogPostPublicRow[]> {
    return blogPostRepository.listLive({ limit, offset: 0, now });
  },

  getRelatedPosts(postId: string, categoryId: string | null, limit = 3, now: Date = new Date()) {
    return blogPostRepository.listRelated(postId, categoryId, limit, now);
  },

  listForFeeds(now: Date = new Date()) {
    return blogPostRepository.listLiveForFeeds(now);
  },

  listForFullFeeds(limit = 20, now: Date = new Date()) {
    return blogPostRepository.listLiveForFullFeeds(limit, now);
  },

  /**
   * Mencatat satu tampilan halaman. Bot, artikel yang tidak tayang, dan
   * kunjungan ulang oleh pengunjung yang sama dalam jendela dedup tidak dihitung.
   */
  async recordView(
    input: {
      postId: string;
      ip: string;
      userAgent: string;
      referrer: string | null;
      ownHosts: Array<string | null | undefined>;
    },
    now: Date = new Date()
  ): Promise<"counted" | "bot" | "duplicate" | "not_found"> {
    if (isBotUserAgent(input.userAgent)) return "bot";

    const post = await blogPostRepository.findLiveId(input.postId, now);
    if (!post) return "not_found";

    const secret = process.env.BETTER_AUTH_SECRET ?? "pvi-blog-views";
    const hash = visitorHash(input.ip, input.userAgent, jakartaDay(now), secret);
    const since = new Date(now.getTime() - VIEW_DEDUP_WINDOW_MS);
    if (await blogViewRepository.hasViewSince(post.id, hash, since)) return "duplicate";

    await blogViewRepository.record(
      post.id,
      hash,
      normalizeReferrerHost(input.referrer, input.ownHosts),
      now
    );
    return "counted";
  },

  /**
   * Mencatat tanggapan pembaca ("Apakah artikel ini membantu?").
   * Bot diabaikan, artikel harus tayang.
   */
  async recordVote(
    input: {
      postId: string;
      vote: VoteStatus;
      ip: string;
      userAgent: string;
    },
    now: Date = new Date()
  ): Promise<{
    status: "counted" | "bot" | "not_found";
    data?: { upvoteCount: number; downvoteCount: number; userVote: VoteStatus };
  }> {
    if (isBotUserAgent(input.userAgent)) return { status: "bot" };
    const post = await blogPostRepository.findLiveId(input.postId, now);
    if (!post) return { status: "not_found" };

    const secret = process.env.BETTER_AUTH_SECRET ?? "pvi-blog-votes";
    const hash = visitorHash(input.ip, input.userAgent, "feedback-vote", secret);
    const data = await blogVoteRepository.recordVote(post.id, hash, input.vote);
    return { status: "counted", data };
  },

  /** Mengambil status vote dan jumlah terkini untuk artikel tayang. */
  async getVoteStatus(
    postId: string,
    ip: string,
    userAgent: string,
    now: Date = new Date()
  ): Promise<{
    status: "ok" | "not_found";
    data?: { upvoteCount: number; downvoteCount: number; userVote: VoteStatus };
  }> {
    const post = await blogPostRepository.findLiveId(postId, now);
    if (!post) return { status: "not_found" };

    const secret = process.env.BETTER_AUTH_SECRET ?? "pvi-blog-votes";
    const hash = visitorHash(ip, userAgent, "feedback-vote", secret);
    const [counts, userVote] = await Promise.all([
      blogVoteRepository.getCounts(post.id),
      blogVoteRepository.findUserVote(post.id, hash),
    ]);
    return {
      status: "ok",
      data: {
        upvoteCount: counts.upvoteCount,
        downvoteCount: counts.downvoteCount,
        userVote,
      },
    };
  },
};
