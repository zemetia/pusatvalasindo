/**
 * Pembanding dua angka uang yang toleran ke pembulatan 2 desimal — dipakai di
 * seluruh pengecekan "klop" (bank, kas, cross-check). Tanpa ini, dua angka yang
 * tampil sama persis di layar (dibulatkan 2 desimal) bisa dibaca "belum klop"
 * hanya karena beda di desimal ke-3 dan seterusnya.
 */
export function roundTo2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** `true` kalau `a` dan `b` sama setelah dibulatkan 2 desimal. */
export function isKlopMatch(a: number, b: number): boolean {
  return roundTo2(a) === roundTo2(b);
}
