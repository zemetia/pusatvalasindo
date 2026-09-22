/**
 * LLMs.txt — https://llmstxt.org/. Dilayani di /llms.txt (teks polos).
 * Isi dibangun di src/lib/llms.ts dari config/group.ts, config/site.ts, dan content/*.
 */

import { buildLlmsTxt } from '@/lib/llms';

export function GET(): Response {
  return new Response(buildLlmsTxt(), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
    },
  });
}
