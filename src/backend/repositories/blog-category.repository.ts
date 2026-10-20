import prisma from "@/lib/prisma";
import type { Prisma } from "@src/generated/prisma/client";

const WITH_COUNT = { _count: { select: { posts: true } } } satisfies Prisma.BlogCategoryInclude;

export type BlogCategoryRow = Prisma.BlogCategoryGetPayload<{ include: typeof WITH_COUNT }>;

export const blogCategoryRepository = {
  list(): Promise<BlogCategoryRow[]> {
    return prisma.blogCategory.findMany({ include: WITH_COUNT, orderBy: { name: "asc" } });
  },

  findById(id: string): Promise<BlogCategoryRow | null> {
    return prisma.blogCategory.findUnique({ where: { id }, include: WITH_COUNT });
  },

  findBySlug(slug: string): Promise<BlogCategoryRow | null> {
    return prisma.blogCategory.findUnique({ where: { slug }, include: WITH_COUNT });
  },

  create(data: { name: string; slug: string; description: string | null }): Promise<BlogCategoryRow> {
    return prisma.blogCategory.create({ data, include: WITH_COUNT });
  },

  update(
    id: string,
    data: { name?: string; slug?: string; description?: string | null }
  ): Promise<BlogCategoryRow> {
    return prisma.blogCategory.update({ where: { id }, data, include: WITH_COUNT });
  },

  async delete(id: string): Promise<void> {
    await prisma.blogCategory.delete({ where: { id } });
  },
};
