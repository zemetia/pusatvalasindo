import type { MetadataRoute } from 'next';

import { siteConfig } from '@/config/site';

/**
 * Daftar AI crawlers & search bots untuk Generative Engine Optimization (GEO).
 * Mencakup bot mesin pencari AI generasi terbaru (OpenAI, Anthropic, Google, Perplexity, Apple, Meta, Cohere, dll).
 */
const AI_BOTS = [
  'GPTBot',
  'ChatGPT-User',
  'OAI-SearchBot',
  'ClaudeBot',
  'Claude-SearchBot',
  'Anthropic-AI',
  'PerplexityBot',
  'Google-Extended',
  'GoogleOther',
  'Applebot-Extended',
  'Applebot',
  'cohere-ai',
  'Meta-ExternalAgent',
  'FacebookBot',
  'DuckAssistBot',
  'Bytespider',
  'Amazonbot',
  'CCBot',
  'YouBot',
];

const DISALLOWED_PRIVATE = [
  '/api/',
  '/dashboard',
  '/dashboard/',
  '/login',
  '/signup',
  '/logout',
  '/old',
  '/old/',
  '/metrics-preview',
  '/en/api/',
  '/en/dashboard',
  '/en/dashboard/',
  '/en/login',
  '/en/signup',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: DISALLOWED_PRIVATE,
      },
      {
        userAgent: AI_BOTS,
        allow: [
          '/',
          '/blog',
          '/blog/',
          '/pusat-valas-indo',
          '/pusat-kirim-duit',
          '/money-changer-terbaik',
          '/lokasi/',
          '/llms.txt',
          '/llms-full.txt',
          '/sitemap.xml',
          '/feed.xml',
          '/opengraph-image',
          '/images/',
        ],
        disallow: DISALLOWED_PRIVATE,
      },
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`,
    host: siteConfig.url,
  };
}

