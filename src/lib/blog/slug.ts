/** Slug blog: huruf kecil, angka, dan tanda hubung tunggal — aman untuk URL & tidak ambigu. */
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const SLUG_MAX = 90;

/**
 * Judul → slug. Menghapus diakritik, mengganti "&" dengan "dan" (bahasa situs),
 * dan memotong di batas kata supaya URL tidak berakhir di tengah kata.
 */
export function slugify(input: string, maxLength: number = SLUG_MAX): string {
  const s = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " dan ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (s.length <= maxLength) return s;
  const cut = s.slice(0, maxLength);
  const lastDash = cut.lastIndexOf("-");
  return (lastDash > 20 ? cut.slice(0, lastDash) : cut).replace(/-+$/g, "");
}

export function isValidSlug(slug: string): boolean {
  return slug.length > 0 && slug.length <= SLUG_MAX && SLUG_RE.test(slug);
}
