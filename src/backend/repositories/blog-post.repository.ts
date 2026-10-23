import prisma from "@/lib/prisma";
import type { BlogPostStatus, Prisma } from "@src/generated/prisma/client";
import type { BlogDisplayStatus } from "@/lib/blog/status";

const AUTHOR = { select: { id: true, name: true } } as const;
const CATEGORY = { select: { id: true, name: true, slug: true } } as const;

/** Kolom untuk daftar admin — tanpa `content` (bisa ratusan KB per artikel). */
const LIST_SELECT = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,
  coverImageUrl: true,
  coverImageAlt: true,
  status: true,
  publishedAt: true,
  readingMinutes: true,
  viewCount: true,
  upvoteCount: true,
  downvoteCount: true,
  categoryId: true,
  createdAt: true,
  updatedAt: true,
  category: CATEGORY,
  author: AUTHOR,
} satisfies Prisma.BlogPostSelect;

/** Kolom untuk kartu di situs publik — tidak membocorkan penulis internal. */
const PUBLIC_LIST_SELECT = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,
  coverImageUrl: true,
  coverImageAlt: true,
  publishedAt: true,
  updatedAt: true,
  readingMinutes: true,
  viewCount: true,
  upvoteCount: true,
  downvoteCount: true,
  category: CATEGORY,
} satisfies Prisma.BlogPostSelect;

const FULL_INCLUDE = { category: CATEGORY, author: AUTHOR } satisfies Prisma.BlogPostInclude;

export type BlogPostListRow = Prisma.BlogPostGetPayload<{ select: typeof LIST_SELECT }>;
export type BlogPostPublicRow = Prisma.BlogPostGetPayload<{ select: typeof PUBLIC_LIST_SELECT }>;
export type BlogPostFull = Prisma.BlogPostGetPayload<{ include: typeof FULL_INCLUDE }>;

/** Kategori untuk situs publik; `_count.posts` hanya menghitung artikel yang sedang tayang. */
export type BlogLiveCategoryRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  updatedAt: Date;
  _count: { posts: number };
};

const liveCategorySelect = (live: Prisma.BlogPostWhereInput) =>
  ({
    id: true,
    slug: true,
    name: true,
    description: true,
    updatedAt: true,
    _count: { select: { posts: { where: live } } },
  }) satisfies Prisma.BlogCategorySelect;

export type BlogListParams = {
  status?: BlogDisplayStatus;
  search?: string;
  /** id kategori, atau "none" untuk artikel tanpa kategori. */
  categoryId?: string;
  limit?: number;
  offset?: number;
  now?: Date;
};

function statusWhere(status: BlogDisplayStatus, now: Date): Prisma.BlogPostWhereInput {
  switch (status) {
    case "DRAFT":
      return { status: "DRAFT" };
    case "ARCHIVED":
      return { status: "ARCHIVED" };
    case "SCHEDULED":
      return { status: "PUBLISHED", publishedAt: { gt: now } };
    case "PUBLISHED":
      return { status: "PUBLISHED", publishedAt: { lte: now } };
  }
}

function listWhere({ status, search, categoryId, now = new Date() }: BlogListParams): Prisma.BlogPostWhereInput {
  const and: Prisma.BlogPostWhereInput[] = [];
  if (status) and.push(statusWhere(status, now));
  if (categoryId) and.push(categoryId === "none" ? { categoryId: null } : { categoryId });
  const q = search?.trim();
  if (q) {
    and.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { slug: { contains: q, mode: "insensitive" } },
        { excerpt: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  return and.length ? { AND: and } : {};
}

const liveWhere = (now: Date): Prisma.BlogPostWhereInput => ({
  status: "PUBLISHED",
  publishedAt: { lte: now },
});

export const blogPostRepository = {
  // ── Admin ────────────────────────────────────────────────────────────────
  list(params: BlogListParams = {}): Promise<BlogPostListRow[]> {
    return prisma.blogPost.findMany({
      where: listWhere(params),
      select: LIST_SELECT,
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: params.limit ?? 50,
      skip: params.offset ?? 0,
    });
  },

  count(params: BlogListParams = {}): Promise<number> {
    return prisma.blogPost.count({ where: listWhere(params) });
  },

  findById(id: string): Promise<BlogPostFull | null> {
    return prisma.blogPost.findUnique({ where: { id }, include: FULL_INCLUDE });
  },

  findBySlug(slug: string): Promise<BlogPostFull | null> {
    return prisma.blogPost.findUnique({ where: { slug }, include: FULL_INCLUDE });
  },

  /** True kalau `slug` dipakai artikel lain — sebagai slug aktif ATAU slug lama yang masih diarahkan. */
  async slugTaken(slug: string, excludePostId?: string): Promise<boolean> {
    const [post, history] = await Promise.all([
      prisma.blogPost.findUnique({ where: { slug }, select: { id: true } }),
      prisma.blogPostSlugHistory.findUnique({ where: { slug }, select: { postId: true } }),
    ]);
    return (!!post && post.id !== excludePostId) || (!!history && history.postId !== excludePostId);
  },

  create(data: Prisma.BlogPostUncheckedCreateInput): Promise<BlogPostFull> {
    return prisma.blogPost.create({ data, include: FULL_INCLUDE });
  },

  /**
   * Memperbarui artikel. Perubahan slug dan catatan slug lamanya harus atomik:
   * kalau salah satunya gagal, URL lama yang sudah terindeks tidak boleh hilang
   * tanpa redirect.
   */
  update(
    id: string,
    data: Prisma.BlogPostUncheckedUpdateInput,
    slugHistory?: { add?: string; remove?: string }
  ): Promise<BlogPostFull> {
    return prisma.$transaction(async (tx) => {
      if (slugHistory?.remove) {
        await tx.blogPostSlugHistory.deleteMany({ where: { slug: slugHistory.remove, postId: id } });
      }
      if (slugHistory?.add) {
        await tx.blogPostSlugHistory.upsert({
          where: { slug: slugHistory.add },
          create: { slug: slugHistory.add, postId: id },
          update: { postId: id },
        });
      }
      return tx.blogPost.update({ where: { id }, data, include: FULL_INCLUDE });
    });
  },

  async delete(id: string): Promise<void> {
    await prisma.blogPost.delete({ where: { id } });
  },

  /** Jumlah artikel per status tampilan, untuk ringkasan di dashboard. */
  async countByDisplayStatus(now: Date = new Date()): Promise<Record<BlogDisplayStatus, number>> {
    const [byStatus, scheduled] = await Promise.all([
      prisma.blogPost.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.blogPost.count({ where: statusWhere("SCHEDULED", now) }),
    ]);
    const n = (s: BlogPostStatus) => byStatus.find((r) => r.status === s)?._count._all ?? 0;
    // PUBLISHED di DB mencakup yang terjadwal; ke admin keduanya ditampilkan terpisah.
    return {
      DRAFT: n("DRAFT"),
      ARCHIVED: n("ARCHIVED"),
      SCHEDULED: scheduled,
      PUBLISHED: n("PUBLISHED") - scheduled,
    };
  },

  /** Total tampilan sepanjang masa seluruh artikel (dari penghitung yang didenormalisasi). */
  async sumViews(): Promise<number> {
    const r = await prisma.blogPost.aggregate({ _sum: { viewCount: true } });
    return r._sum.viewCount ?? 0;
  },

  // ── Publik ───────────────────────────────────────────────────────────────
  findLiveBySlug(slug: string, now: Date = new Date()): Promise<BlogPostFull | null> {
    return prisma.blogPost.findFirst({
      where: { slug, ...liveWhere(now) },
      include: FULL_INCLUDE,
    });
  },

  /** Slug lama → slug aktif artikelnya, hanya kalau artikel itu sedang tayang. */
  async findRedirectTarget(oldSlug: string, now: Date = new Date()): Promise<string | null> {
    const row = await prisma.blogPostSlugHistory.findUnique({
      where: { slug: oldSlug },
      select: { post: { select: { slug: true, status: true, publishedAt: true } } },
    });
    const post = row?.post;
    if (!post || post.status !== "PUBLISHED" || !post.publishedAt || post.publishedAt > now) return null;
    return post.slug;
  },

  listLive(opts: { limit: number; offset: number; categoryId?: string; now?: Date }): Promise<BlogPostPublicRow[]> {
    return prisma.blogPost.findMany({
      where: { ...liveWhere(opts.now ?? new Date()), ...(opts.categoryId ? { categoryId: opts.categoryId } : {}) },
      select: PUBLIC_LIST_SELECT,
      orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
      take: opts.limit,
      skip: opts.offset,
    });
  },

  countLive(now: Date = new Date(), categoryId?: string): Promise<number> {
    return prisma.blogPost.count({ where: { ...liveWhere(now), ...(categoryId ? { categoryId } : {}) } });
  },

  /** Kategori yang punya minimal satu artikel tayang, dengan jumlah artikel tayangnya. Kategori kosong tidak ikut. */
  listLiveCategories(now: Date = new Date()): Promise<BlogLiveCategoryRow[]> {
    const live = liveWhere(now);
    return prisma.blogCategory.findMany({
      where: { posts: { some: live } },
      select: liveCategorySelect(live),
      orderBy: { name: "asc" },
    });
  },

  /** Satu kategori by slug, hanya bila punya artikel tayang (kategori kosong = 404 di situs publik). */
  findLiveCategoryBySlug(slug: string, now: Date = new Date()): Promise<BlogLiveCategoryRow | null> {
    const live = liveWhere(now);
    return prisma.blogCategory.findFirst({
      where: { slug, posts: { some: live } },
      select: liveCategorySelect(live),
    });
  },

  /** Artikel terkait: sekategori dulu, sisanya diisi artikel terbaru lain. */
  async listRelated(
    postId: string,
    categoryId: string | null,
    limit: number,
    now: Date = new Date()
  ): Promise<BlogPostPublicRow[]> {
    const base = { ...liveWhere(now), id: { not: postId } };
    const same = categoryId
      ? await prisma.blogPost.findMany({
          where: { ...base, categoryId },
          select: PUBLIC_LIST_SELECT,
          orderBy: { publishedAt: "desc" },
          take: limit,
        })
      : [];
    if (same.length >= limit) return same;
    const filler = await prisma.blogPost.findMany({
      where: { ...base, id: { notIn: [postId, ...same.map((p) => p.id)] } },
      select: PUBLIC_LIST_SELECT,
      orderBy: { publishedAt: "desc" },
      take: limit - same.length,
    });
    return [...same, ...filler];
  },

  /** Untuk sitemap, feed RSS, & llms.txt. */
  listLiveForFeeds(
    now: Date = new Date()
  ): Promise<Array<{ slug: string; title: string; excerpt: string; coverImageUrl?: string | null; publishedAt: Date | null; updatedAt: Date; category?: { name: string; slug: string } | null }>> {
    return prisma.blogPost.findMany({
      where: liveWhere(now),
      select: {
        slug: true,
        title: true,
        excerpt: true,
        coverImageUrl: true,
        publishedAt: true,
        updatedAt: true,
        category: { select: { name: true, slug: true } },
      },
      orderBy: { publishedAt: "desc" },
      take: 1000,
    });
  },

  /** Untuk llms-full.txt: memuat konten Markdown lengkap artikel terbaru. */
  listLiveForFullFeeds(
    limit = 20,
    now: Date = new Date()
  ): Promise<Array<{ slug: string; title: string; excerpt: string; content: string; publishedAt: Date | null; updatedAt: Date; category?: { name: string } | null }>> {
    return prisma.blogPost.findMany({
      where: liveWhere(now),
      select: {
        slug: true,
        title: true,
        excerpt: true,
        content: true,
        publishedAt: true,
        updatedAt: true,
        category: { select: { name: true } },
      },
      orderBy: { publishedAt: "desc" },
      take: limit,
    });
  },

  /** Tampil untuk pencatat view: hanya id artikel yang sedang tayang. */
  findLiveId(id: string, now: Date = new Date()): Promise<{ id: string; viewCount: number } | null> {
    return prisma.blogPost.findFirst({ where: { id, ...liveWhere(now) }, select: { id: true, viewCount: true } });
  },
};
