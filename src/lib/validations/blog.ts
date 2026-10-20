import { z } from "zod";
import { SLUG_MAX, SLUG_RE } from "@/lib/blog/slug";

/** String kosong dari form dianggap "tidak diisi" → null, bukan string kosong yang lolos validasi. */
const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

const nullableText = (max: number) =>
  z.preprocess(emptyToNull, z.string().trim().max(max).nullable().optional());

/** https absolut atau path relatif dari root situs. `http:` ditolak (mixed content) begitu juga `//host` & `javascript:`. */
const coverUrl = z.preprocess(
  emptyToNull,
  z
    .string()
    .trim()
    .max(500)
    .refine((v) => /^https:\/\/[^\s]+$/i.test(v) || /^\/(?!\/)[^\s]*$/.test(v), {
      message: "Harus URL https:// atau path yang diawali / (mis. /images/blog/cover.jpg)",
    })
    .nullable()
    .optional()
);

export const blogSlugSchema = z
  .string()
  .trim()
  .min(1, "Slug wajib diisi")
  .max(SLUG_MAX, `Slug maksimal ${SLUG_MAX} karakter`)
  .regex(SLUG_RE, "Slug hanya boleh huruf kecil, angka, dan tanda hubung tunggal");

export const blogStatusSchema = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);

const blogPostFields = {
  title: z.string().trim().min(3, "Judul minimal 3 karakter").max(160, "Judul maksimal 160 karakter"),
  slug: blogSlugSchema.optional(),
  excerpt: z
    .string()
    .trim()
    .min(10, "Ringkasan minimal 10 karakter")
    .max(320, "Ringkasan maksimal 320 karakter"),
  content: z.string().trim().min(1, "Isi artikel wajib diisi").max(100_000, "Isi artikel terlalu panjang"),
  coverImageUrl: coverUrl,
  coverImageAlt: nullableText(200),
  metaTitle: nullableText(70),
  metaDescription: nullableText(170),
  categoryId: z.preprocess(emptyToNull, z.string().trim().min(1).max(40).nullable().optional()),
  status: blogStatusSchema.optional(),
  /** ISO-8601 dengan zona waktu. Null = hapus tanggal. */
  publishedAt: z.preprocess(emptyToNull, z.string().datetime({ offset: true }).nullable().optional()),
};

export const createBlogPostSchema = z.object(blogPostFields);
export const updateBlogPostSchema = z.object(blogPostFields).partial();

export type CreateBlogPostInput = z.infer<typeof createBlogPostSchema>;
export type UpdateBlogPostInput = z.infer<typeof updateBlogPostSchema>;

export const createBlogCategorySchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter").max(60, "Nama maksimal 60 karakter"),
  slug: blogSlugSchema.optional(),
  description: nullableText(200),
});
export const updateBlogCategorySchema = createBlogCategorySchema.partial();

export type CreateBlogCategoryInput = z.infer<typeof createBlogCategorySchema>;
export type UpdateBlogCategoryInput = z.infer<typeof updateBlogCategorySchema>;

/** Endpoint publik pencatat tampilan. Isinya tidak dipercaya — hanya dipakai setelah dicocokkan ke artikel yang tayang. */
export const blogViewSchema = z.object({
  postId: z.string().trim().min(1).max(40),
  referrer: z.string().max(500).nullable().optional(),
});
