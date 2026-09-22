import type { MetadataRoute } from 'next';

import { routing } from '@/i18n/routing';
import { siteConfig } from '@/config/site';

const urlFor = (locale: string, path: string) => {
  const prefix = locale === routing.defaultLocale ? '' : `/${locale}`;
  return `${siteConfig.url}${prefix}${path === '/' ? '' : path}`;
};

/**
 * Sitemap dari siteConfig.pages — satu entri per halaman × locale, masing-masing
 * dengan alternates hreflang. `lastModified` diambil dari tanggal edit konten nyata di
 * `siteConfig.pages[*].lastModified` — jangan pakai new Date() (sinyal palsu tiap request).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return Object.values(siteConfig.pages).flatMap((page) => {
    const languages = {
      ...Object.fromEntries(siteConfig.contentLocales.map((l) => [l, urlFor(l, page.path)])),
      'x-default': urlFor(routing.defaultLocale, page.path),
    };
    return siteConfig.contentLocales.map((locale) => ({
      url: urlFor(locale, page.path),
      lastModified: page.lastModified,
      changeFrequency: page.changeFreq,
      priority: page.priority,
      alternates: { languages },
    }));
  });
}
