import { slugify } from "./slug";

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

export interface Heading {
  id: string;
  text: string;
  level: 2 | 3;
}

export interface ExtractedFaq {
  question: string;
  answer: string;
}

/**
 * Mengekstrak FAQ dari Markdown artikel bila ada bagian FAQ/Tanya Jawab.
 * Format:
 * ## FAQ / ## Pertanyaan Umum / ## Tanya Jawab
 * ### Pertanyaan?
 * Teks jawaban (dibersihkan dari format markdown).
 */
export function extractFaqs(md: string): ExtractedFaq[] {
  // Normalisasi line endings agar multiline regex konsisten di semua platform/browser
  const normalized = md.replace(/\r\n/g, "\n");
  const clean = normalized.replace(/```[\s\S]*?```/g, "");
  const match = clean.match(/^#{1,2}\s+(?:FAQ|Pertanyaan\s+(?:Umum|yang\s+Sering\s+Diajukan)|Tanya\s+Jawab|Frequently\s+Asked\s+Questions)[\s\S]*$/im);
  if (!match) return [];

  const sectionText = match[0];
  const nextHeading = sectionText.slice(3).search(/^#{1,2}\s+/m);
  const relevant = nextHeading !== -1 ? sectionText.slice(0, nextHeading + 3) : sectionText;

  const faqs: ExtractedFaq[] = [];
  const qMatches = Array.from(relevant.matchAll(/^#{3,4}\s+(.+?)\s*#*$/gm));

  for (let i = 0; i < qMatches.length; i++) {
    const qMatch = qMatches[i];
    const matchIdx = qMatch.index ?? 0;
    const question = qMatch[1].replace(/[*_`~]/g, "").trim();
    const startIdx = matchIdx + qMatch[0].length;
    const nextMatch = i + 1 < qMatches.length ? qMatches[i + 1] : undefined;
    const endIdx = nextMatch?.index ?? relevant.length;
    const rawAnswer = relevant.slice(startIdx, endIdx);
    const answer = stripMarkdown(rawAnswer);
    if (question && answer) {
      faqs.push({ question, answer });
    }
  }

  return faqs;
}

/** Daftar isi dari heading Markdown (# dan ## → level 2, ### → level 3); id sama dengan anchor yang dirender. */
export function extractHeadings(md: string): Heading[] {
  const out: Heading[] = [];
  for (const m of md.replace(/```[\s\S]*?```/g, "").matchAll(/^(#{1,3})\s+(.+?)\s*#*\s*$/gm)) {
    const text = m[2].replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[*_`~]/g, "").trim();
    const id = slugify(text);
    if (id) out.push({ id, text, level: m[1].length === 3 ? 3 : 2 });
  }
  return out;
}

