export type BlogStoredStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

/** Status yang dilihat admin. "Terjadwal" diturunkan, bukan disimpan (lihat schema BlogPost). */
export type BlogDisplayStatus = "DRAFT" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED";

export const DISPLAY_STATUS_LABEL: Record<BlogDisplayStatus, string> = {
  DRAFT: "Draft",
  SCHEDULED: "Terjadwal",
  PUBLISHED: "Terbit",
  ARCHIVED: "Diarsipkan",
};

export const DISPLAY_STATUSES = Object.keys(DISPLAY_STATUS_LABEL) as BlogDisplayStatus[];

export function displayStatus(
  post: { status: BlogStoredStatus; publishedAt: Date | string | null },
  now: Date = new Date()
): BlogDisplayStatus {
  if (post.status !== "PUBLISHED") return post.status;
  if (!post.publishedAt) return "DRAFT"; // PUBLISHED tanpa tanggal tidak tayang di mana pun — perlakukan sebagai draft.
  return new Date(post.publishedAt).getTime() > now.getTime() ? "SCHEDULED" : "PUBLISHED";
}

/** Tayang di situs publik sekarang? */
export function isLive(
  post: { status: BlogStoredStatus; publishedAt: Date | string | null },
  now: Date = new Date()
): boolean {
  return displayStatus(post, now) === "PUBLISHED";
}
