import prisma from "@/lib/prisma";
import {
  dailyQuery,
  postViewsQuery,
  referrersQuery,
  topPostsQuery,
  totalsQuery,
  type DailyRow,
  type PostViewsRow,
  type ReferrerRow,
  type TopPostRow,
  type TotalsRow,
} from "./blog-analytics.queries";

export const blogViewRepository = {
  /** Sudah ada tampilan dari pengunjung (hash harian) ini untuk artikel ini sejak `since`? */
  async hasViewSince(postId: string, visitorHash: string, since: Date): Promise<boolean> {
    const row = await prisma.blogPostView.findFirst({
      where: { postId, visitorHash, viewedAt: { gte: since } },
      select: { id: true },
    });
    return row !== null;
  },

  /** Mencatat satu tampilan dan menaikkan penghitung total artikel dalam satu transaksi. */
  async record(
    postId: string,
    visitorHash: string,
    referrerHost: string | null,
    viewedAt: Date = new Date()
  ): Promise<void> {
    await prisma.$transaction([
      // `viewedAt` diisi eksplisit (UTC) alih-alih mengandalkan DEFAULT CURRENT_TIMESTAMP:
      // kolom bertipe `timestamp` tanpa zona, jadi default di sisi DB akan mengikuti zona sesi.
      prisma.blogPostView.create({ data: { postId, visitorHash, referrerHost, viewedAt } }),
      prisma.blogPost.update({ where: { id: postId }, data: { viewCount: { increment: 1 } } }),
    ]);
  },

  async totals(from: Date, to: Date, postId?: string): Promise<TotalsRow> {
    const rows = await prisma.$queryRaw<TotalsRow[]>(totalsQuery(from, to, postId));
    return rows[0] ?? { views: 0, visitors: 0 };
  },

  daily(from: Date, to: Date, postId?: string): Promise<DailyRow[]> {
    return prisma.$queryRaw<DailyRow[]>(dailyQuery(from, to, postId));
  },

  topPosts(from: Date, to: Date, limit = 10): Promise<TopPostRow[]> {
    return prisma.$queryRaw<TopPostRow[]>(topPostsQuery(from, to, limit));
  },

  referrers(from: Date, to: Date, limit = 10, postId?: string): Promise<ReferrerRow[]> {
    return prisma.$queryRaw<ReferrerRow[]>(referrersQuery(from, to, limit, postId));
  },

  /** Tampilan per artikel dalam rentang, untuk kolom "Views" di daftar. */
  async viewsByPost(from: Date, to: Date): Promise<Map<string, PostViewsRow>> {
    const rows = await prisma.$queryRaw<PostViewsRow[]>(postViewsQuery(from, to));
    return new Map(rows.map((r) => [r.postId, r]));
  },
};
