import type { MetadataRoute } from 'next';

import { blogService } from '@/backend/services/blog.service';
import { routing } from '@/i18n/routing';
import { siteConfig } from '@/config/site';

/**
 * Sitemap memuat artikel blog dari database, jadi disegarkan tiap jam dan juga
 * langsung saat artikel diterbitkan/diubah (revalidatePath('/sitemap.xml') di blog.service).
 */
export const revalidate = 3600;

const urlFor = (locale: string, path: string) => {
  const prefix = locale === routing.defaultLocale ? '' : `/${locale}`;
  return `${siteConfig.url}${prefix}${path === '/' ? '' : path}`;
};

const alternatesFor = (path: string) => ({
  languages: {
    ...Object.fromEntries(siteConfig.contentLocales.map((l) => [l, urlFor(l, path)])),
    'x-default': urlFor(routing.defaultLocale, path),
  },
});

/** Artikel terbit. Gagal membaca database tidak boleh menjatuhkan sitemap — halaman statis tetap tayang. */
async function livePosts() {
  try {
    return await blogService.listForFeeds();
  } catch (error) {
    console.error('[sitemap] gagal membaca artikel blog:', error instanceof Error ? error.message : error);
    return [];
  }
}

/**
 * Sitemap dari siteConfig.pages — satu entri per halaman × locale, masing-masing
 * dengan alternates hreflang. `lastModified` diambil dari tanggal edit konten nyata di
 * `siteConfig.pages[*].lastModified` — jangan pakai new Date() (sinyal palsu tiap request).
 *
 * Blog: kategori yang punya artikel tayang masuk sebagai `/blog/kategori/<slug>`; indeks `/blog` hanya masuk bila sudah ada artikel terbit, dengan lastModified =
 * artikel yang terakhir berubah; tiap artikel masuk dengan `updatedAt`-nya sendiri.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await livePosts();
  const latestPostChange = posts.reduce<Date | null>(
    (latest, p) => (latest === null || p.updatedAt > latest ? p.updatedAt : latest),
    null
  );

  const pageEntries = Object.entries(siteConfig.pages).flatMap(([key, page]) => {
    if (key === 'blog' && (posts.length === 0 || latestPostChange === null)) return [];
    const lastModified = key === 'blog' && latestPostChange ? latestPostChange : page.lastModified;
    return siteConfig.contentLocales.map((locale) => ({
      url: urlFor(locale, page.path),
      lastModified,
      changeFrequency: page.changeFreq,
      priority: page.priority,
      alternates: alternatesFor(page.path),
    }));
  });

  const postEntries = posts.flatMap((post) =>
    siteConfig.contentLocales.map((locale) => ({
      url: urlFor(locale, `/blog/${post.slug}`),
      lastModified: post.updatedAt,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
      alternates: alternatesFor(`/blog/${post.slug}`),
    }))
  );

  // Halaman kategori: hanya kategori yang punya artikel tayang (ikut dari `posts`, jadi tanpa query tambahan).
  // lastModified = artikel terakhir berubah di kategori itu.
  const categoryChanges = new Map<string, Date>();
  for (const post of posts) {
    if (!post.category) continue;
    const seen = categoryChanges.get(post.category.slug);
    if (!seen || post.updatedAt > seen) categoryChanges.set(post.category.slug, post.updatedAt);
  }
  const categoryEntries = Array.from(categoryChanges, ([slug, lastModified]) =>
    siteConfig.contentLocales.map((locale) => ({
      url: urlFor(locale, `/blog/kategori/${slug}`),
      lastModified,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
      alternates: alternatesFor(`/blog/kategori/${slug}`),
    }))
  ).flat();

  return [...pageEntries, ...categoryEntries, ...postEntries];
}
