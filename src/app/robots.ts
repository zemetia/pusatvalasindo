import type { MetadataRoute } from 'next';

import { siteConfig } from '@/config/site';

/** Halaman publik yang boleh dikutip mesin AI: landing, halaman layanan, halaman cabang. */
const AI_ALLOWED = [
  '/$',
  '/pusat-valas-indo',
  '/pusat-kirim-duit',
  '/money-changer-terbaik',
  '/lokasi/',
  '/llms.txt',
  '/llms-full.txt',
];

const AI_BOTS = [
  'GPTBot',
  'ChatGPT-User',
  'OAI-SearchBot',
  'ClaudeBot',
  'Claude-SearchBot',
  'PerplexityBot',
  'Google-Extended',
  'Applebot-Extended',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/dashboard', '/login', '/signup', '/logout', '/old', '/metrics-preview', '/_next/'],
      },
      { userAgent: AI_BOTS, allow: AI_ALLOWED, disallow: '/' },
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`,
    host: siteConfig.url,
  };
}
