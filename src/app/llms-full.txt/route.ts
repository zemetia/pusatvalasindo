/** /llms-full.txt — isi lengkap situs dalam teks polos untuk agen AI. Lihat src/lib/llms.ts. */

import { buildLlmsFullTxt } from '@/lib/llms';

export function GET(): Response {
  return new Response(buildLlmsFullTxt(), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
    },
  });
}
