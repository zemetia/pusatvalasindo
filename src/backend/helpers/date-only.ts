/**
 * Tanggal di modul harian (stockist, kas, bank) selalu mengalir sebagai UTC-midnight
 * hasil parsing "YYYY-MM-DD" dari query/body. `todayDateOnly()` memakai konvensi yang
 * sama supaya perbandingan "hari ini vs tanggal lampau" konsisten di semua endpoint.
 */
export function todayDateOnly(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** True kalau `date` sudah lewat (lebih tua dari hari ini) — syarat verifikasi H+1. */
export function isPastDate(date: Date): boolean {
  return date.getTime() < todayDateOnly().getTime();
}
