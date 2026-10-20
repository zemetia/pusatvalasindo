/**
 * LLMs.txt — https://llmstxt.org/. Dilayani di /llms.txt (teks polos).
 * Isi dibangun di src/lib/llms.ts dari config/group.ts, config/site.ts, dan content/*,
 * plus daftar artikel blog yang sedang tayang (database).
 */

import { blogService } from '@/backend/services/blog.service';
import { buildLlmsTxt, type BlogFeedPost } from '@/lib/llms';

/** Disegarkan tiap jam & saat artikel berubah (revalidatePath di blog.service). */
export const revalidate = 3600;

/** Gagal membaca database tidak boleh membuat llms.txt ikut gagal — berkasnya tetap dilayani tanpa bagian blog. */
async function blogPosts(): Promise<BlogFeedPost[]> {
  try {
    return await blogService.listForFeeds();
  } catch (error) {
    console.error('[llms.txt] gagal membaca artikel blog:', error instanceof Error ? error.message : error);
    return [];
  }
}

export async function GET(): Promise<Response> {
  return new Response(buildLlmsTxt(await blogPosts()), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
