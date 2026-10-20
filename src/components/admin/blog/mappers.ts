import type { BlogCategoryRow } from "@/backend/repositories/blog-category.repository";
import type { BlogPostFull } from "@/backend/repositories/blog-post.repository";
import type { BlogPostRow, BlogPostWithStatus } from "@/backend/services/blog.service";

import type { BlogCategoryDTO, BlogPostRowDTO } from "./api";
import type { BlogEditorPostDTO } from "./blog-post-editor";

/**
 * Server → klien: Date menjadi string ISO dan relasi dipangkas ke yang dipakai UI,
 * supaya yang melewati batas RSC hanya data polos (dan tidak ikut membawa `content`
 * penuh ke daftar atau akun penulis ke browser).
 */
export function toRowDTO(p: BlogPostRow): BlogPostRowDTO {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    status: p.displayStatus,
    publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
    updatedAt: p.updatedAt.toISOString(),
    category: p.category ? { id: p.category.id, name: p.category.name } : null,
    rangeViews: p.rangeViews,
    rangeVisitors: p.rangeVisitors,
    viewCount: p.viewCount,
    readingMinutes: p.readingMinutes,
  };
}

export function toCategoryDTO(c: BlogCategoryRow): BlogCategoryDTO {
  return { id: c.id, slug: c.slug, name: c.name, description: c.description, postCount: c._count.posts };
}

export function toEditorDTO(p: BlogPostWithStatus<BlogPostFull>): BlogEditorPostDTO {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt,
    content: p.content,
    coverImageUrl: p.coverImageUrl,
    coverImageAlt: p.coverImageAlt,
    metaTitle: p.metaTitle,
    metaDescription: p.metaDescription,
    categoryId: p.categoryId,
    status: p.displayStatus,
    publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
    viewCount: p.viewCount,
  };
}

/** Pesan galat untuk ErrorPanel; menambah petunjuk bila penyebabnya migrasi blog belum dijalankan. */
export function describeBlogError(err: unknown): string {
  const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  const missingTable = /P2021|does not exist|relation .*Blog/i.test(msg);
  return missingTable
    ? `${msg}\n\nTabel blog belum ada di database ini. Jalankan migrasinya:\n  npx prisma migrate deploy`
    : msg;
}
