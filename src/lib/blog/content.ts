/** Kecepatan baca rata-rata untuk teks berbahasa Indonesia (kata per menit). */
const WORDS_PER_MINUTE = 200;

/**
 * Markdown → teks polos kasar. Cukup untuk menghitung kata; bukan parser
 * Markdown sungguhan, jadi jangan dipakai untuk menghasilkan HTML.
 */
export function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}(?:#{1,6}|>|[-*+]|\d+\.)\s+/gm, "")
    .replace(/[*_~|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function countWords(md: string): number {
  const text = stripMarkdown(md);
  return text ? text.split(" ").length : 0;
}

export function readingMinutes(md: string): number {
  return Math.max(1, Math.ceil(countWords(md) / WORDS_PER_MINUTE));
}
