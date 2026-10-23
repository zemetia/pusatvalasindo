import type { BlogDisplayStatus } from "@/lib/blog/status";

/** Baris artikel di daftar admin — hanya tipe polos (string/number) supaya aman lewat batas server → klien. */
export type BlogPostRowDTO = {
  id: string;
  slug: string;
  title: string;
  status: BlogDisplayStatus;
  publishedAt: string | null;
  updatedAt: string;
  category: { id: string; name: string } | null;
  rangeViews: number;
  rangeVisitors: number;
  viewCount: number;
  upvoteCount?: number;
  downvoteCount?: number;
  readingMinutes: number;
};

export type BlogCategoryDTO = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  postCount: number;
};

type ApiEnvelope<T> = { success: boolean; data: T; message?: string | null; error?: string };

/**
 * fetch JSON ke API blog. Melempar Error berpesan server (mis. "Slug … sudah dipakai")
 * supaya pemanggil cukup `toast.error(e.message)`.
 */
export async function blogApi<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  let json: ApiEnvelope<T> | null = null;
  try {
    json = (await res.json()) as ApiEnvelope<T>;
  } catch {
    // Respons bukan JSON (mis. 502 dari proxy) — jatuh ke pesan generik di bawah.
  }
  if (!res.ok || !json?.success) {
    throw new Error(json?.message || `Permintaan gagal (${res.status})`);
  }
  return json.data;
}
