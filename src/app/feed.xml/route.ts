/**
 * Feed RSS 2.0 untuk Blog Pusat Valas Indo.
 * Membantu mesin pencari (Googlebot, Bingbot), agregator (Feedly),
 * serta crawler LLM (ChatGPT, Perplexity, Claude) menemukan dan mengindeks
 * konten baru dengan cepat.
 */

import { blogService } from '@/backend/services/blog.service';
import { siteConfig } from '@/config/site';

export const revalidate = 3600;

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case '\'':
        return '&apos;';
      case '"':
        return '&quot;';
      default:
        return c;
    }
  });
}

export async function GET(): Promise<Response> {
  let posts: Array<{
    slug: string;
    title: string;
    excerpt: string;
    coverImageUrl?: string | null;
    publishedAt: Date | null;
    updatedAt: Date;
    category?: { name: string } | null;
  }> = [];

  try {
    posts = await blogService.listForFeeds();
  } catch (error) {
    console.error('[feed.xml] gagal membaca artikel blog:', error instanceof Error ? error.message : error);
  }

  const blogUrl = `${siteConfig.url}/blog`;
  const feedUrl = `${siteConfig.url}/feed.xml`;
  const latestBuildDate = posts[0]?.updatedAt ? posts[0].updatedAt.toUTCString() : new Date().toUTCString();

  const itemsXml = posts
    .map((post) => {
      const itemUrl = `${siteConfig.url}/blog/${post.slug}`;
      const pubDate = (post.publishedAt ?? post.updatedAt).toUTCString();
      const categoryTag = post.category ? `\n      <category>${escapeXml(post.category.name)}</category>` : '';
      const fullImageUrl = post.coverImageUrl
        ? post.coverImageUrl.startsWith('http')
          ? post.coverImageUrl
          : `${siteConfig.url}${post.coverImageUrl}`
        : null;
      const mediaTag = fullImageUrl
        ? `\n      <enclosure url="${escapeXml(fullImageUrl)}" type="image/jpeg" length="0" />\n      <media:content url="${escapeXml(fullImageUrl)}" medium="image" />`
        : '';
      return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${itemUrl}</link>
      <guid isPermaLink="true">${itemUrl}</guid>
      <description>${escapeXml(post.excerpt)}</description>
      <pubDate>${pubDate}</pubDate>${categoryTag}${mediaTag}
    </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>${escapeXml(siteConfig.name)} Blog</title>
    <link>${blogUrl}</link>
    <description>${escapeXml(siteConfig.pages.blog?.description ?? siteConfig.description)}</description>
    <language>id</language>
    <lastBuildDate>${latestBuildDate}</lastBuildDate>
    <atom:link href="${feedUrl}" rel="self" type="application/rss+xml"/>
${itemsXml}
  </channel>
</rss>`.trim();

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
