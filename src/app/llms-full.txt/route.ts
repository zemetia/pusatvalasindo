/** /llms-full.txt — isi lengkap situs dalam teks polos untuk agen AI. Lihat src/lib/llms.ts. */

import { blogService } from '@/backend/services/blog.service';
import { buildLlmsFullTxt, type BlogFeedPost } from '@/lib/llms';

/** Disegarkan tiap jam & saat artikel berubah (revalidatePath di blog.service). */
export const revalidate = 3600;

async function blogPosts(): Promise<BlogFeedPost[]> {
  try {
    return await blogService.listForFeeds();
  } catch (error) {
    console.error('[llms-full.txt] gagal membaca artikel blog:', error instanceof Error ? error.message : error);
    return [];
  }
}

export async function GET(): Promise<Response> {
  return new Response(buildLlmsFullTxt(await blogPosts()), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
