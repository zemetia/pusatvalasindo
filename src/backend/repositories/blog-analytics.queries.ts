import { Prisma } from "@src/generated/prisma/client";

/**
 * Query analitik blog sebagai SQL mentah. Dipisah dari repository (yang membawa
 * koneksi Prisma) supaya bentuk SQL-nya bisa dijalankan & diuji tanpa app.
 *
 * Catatan zona waktu — dua jebakan yang sengaja dihindari di sini:
 *   • `viewedAt` bertipe `timestamp` (tanpa zona) yang isinya UTC. Mengelompokkan
 *     per hari WIB berarti `AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta'`
 *     (tafsirkan sebagai UTC, lalu geser ke WIB). `AT TIME ZONE 'Asia/Jakarta'`
 *     saja menafsirkannya sebagai jam WIB dan menggeser hari 14 jam.
 *   • Batas rentang dikirim sebagai string ISO lalu di-cast `::timestamp`. Cast
 *     dari teks membuang sufiks "Z" apa adanya (nilai UTC tetap), sehingga hasilnya
 *     tidak bergantung pada zona waktu sesi database.
 */

const ts = (d: Date) => Prisma.sql`${d.toISOString()}::timestamp`;

function whereRange(from: Date, to: Date, postId?: string): Prisma.Sql {
  const base = Prisma.sql`v."viewedAt" >= ${ts(from)} AND v."viewedAt" < ${ts(to)}`;
  return postId ? Prisma.sql`${base} AND v."postId" = ${postId}` : base;
}

export type TotalsRow = { views: number; visitors: number };
export type DailyRow = { day: string; views: number; visitors: number };
export type TopPostRow = { id: string; title: string; slug: string; views: number; visitors: number };
export type ReferrerRow = { source: string | null; views: number; visitors: number };
export type PostViewsRow = { postId: string; views: number; visitors: number };

export function totalsQuery(from: Date, to: Date, postId?: string): Prisma.Sql {
  return Prisma.sql`
    SELECT COUNT(*)::int AS views, COUNT(DISTINCT v."visitorHash")::int AS visitors
    FROM "BlogPostView" v
    WHERE ${whereRange(from, to, postId)}`;
}

export function dailyQuery(from: Date, to: Date, postId?: string): Prisma.Sql {
  return Prisma.sql`
    SELECT to_char((v."viewedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::date, 'YYYY-MM-DD') AS day,
           COUNT(*)::int AS views,
           COUNT(DISTINCT v."visitorHash")::int AS visitors
    FROM "BlogPostView" v
    WHERE ${whereRange(from, to, postId)}
    GROUP BY 1
    ORDER BY 1`;
}

export function topPostsQuery(from: Date, to: Date, limit: number): Prisma.Sql {
  return Prisma.sql`
    SELECT p."id" AS id, p."title" AS title, p."slug" AS slug,
           COUNT(*)::int AS views,
           COUNT(DISTINCT v."visitorHash")::int AS visitors
    FROM "BlogPostView" v
    JOIN "BlogPost" p ON p."id" = v."postId"
    WHERE ${whereRange(from, to)}
    GROUP BY p."id", p."title", p."slug"
    ORDER BY views DESC, p."title" ASC
    LIMIT ${limit}`;
}

export function referrersQuery(from: Date, to: Date, limit: number, postId?: string): Prisma.Sql {
  return Prisma.sql`
    SELECT v."referrerHost" AS source,
           COUNT(*)::int AS views,
           COUNT(DISTINCT v."visitorHash")::int AS visitors
    FROM "BlogPostView" v
    WHERE ${whereRange(from, to, postId)}
    GROUP BY v."referrerHost"
    ORDER BY views DESC, source ASC NULLS LAST
    LIMIT ${limit}`;
}

export function postViewsQuery(from: Date, to: Date): Prisma.Sql {
  return Prisma.sql`
    SELECT v."postId" AS "postId",
           COUNT(*)::int AS views,
           COUNT(DISTINCT v."visitorHash")::int AS visitors
    FROM "BlogPostView" v
    WHERE ${whereRange(from, to)}
    GROUP BY v."postId"`;
}
