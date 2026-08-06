import type { EmploymentStatus } from "@src/generated/prisma/client";

/**
 * Status ikatan kerja: label, urutan, dan — yang paling penting — arti
 * "berkontrak".
 *
 * Kolom `berkontrak` yang dipakai rule bonus TIDAK disimpan; ia diturunkan di
 * view `hv_employees` (lihat migrasi 20260806000000). Rumus di bawah adalah
 * cerminan persis rumus SQL itu. Kalau salah satunya berubah, keduanya harus
 * berubah — kalau tidak, halaman ini akan menjanjikan bonus yang ditolak mesin
 * payroll, atau sebaliknya.
 */

export const EMPLOYMENT_STATUSES = ["BELUM_KONTRAK", "PROBATION", "PKWT", "PKWTT"] as const;

export const EMPLOYMENT_STATUS_LABELS: Record<EmploymentStatus, string> = {
  BELUM_KONTRAK: "Belum Berkontrak",
  PROBATION: "Masa Percobaan",
  PKWT: "Kontrak (PKWT)",
  PKWTT: "Karyawan Tetap (PKWTT)",
};

/** Keterangan satu baris untuk form — apa konsekuensinya bagi payroll. */
export const EMPLOYMENT_STATUS_HINTS: Record<EmploymentStatus, string> = {
  BELUM_KONTRAK: "Belum diikat kontrak apa pun. Bonus KPI tidak dibayarkan.",
  PROBATION: "Masa percobaan. Belum berkontrak, jadi bonus KPI belum berlaku.",
  PKWT: "Kontrak berjangka. Bonus berlaku sampai tanggal berakhir terlewati.",
  PKWTT: "Karyawan tetap tanpa batas waktu. Bonus KPI berlaku penuh.",
};

/** Status yang memerlukan tanggal mulai kontrak. */
export function needsContractDates(status: EmploymentStatus): boolean {
  return status === "PKWT" || status === "PKWTT";
}

/**
 * Apakah karyawan terhitung berkontrak pada tanggal tertentu.
 *
 * `today` berupa kunci `YYYY-MM-DD`; perbandingan tanggalnya leksikografis
 * supaya tidak ada zona waktu yang ikut campur.
 */
export function isUnderContract(
  status: EmploymentStatus,
  contractEndDate: string | null,
  today: string,
): boolean {
  if (status === "PKWTT") return true;
  // PKWT tanpa tanggal berakhir juga dihitung berkontrak oleh view — itu bukan
  // kelonggaran, melainkan konsekuensi kolomnya nullable. Form melarang
  // keadaan ini terbentuk lewat aplikasi; ini hanya menyamakan bacaan untuk
  // baris lama yang terlanjur begitu.
  if (status === "PKWT") return contractEndDate === null || contractEndDate >= today;
  return false;
}

/** Sisa hari kontrak; null kalau tidak berbatas waktu. Negatif = sudah lewat. */
export function daysUntil(endDate: string | null, today: string): number | null {
  if (!endDate) return null;
  const ms = Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}
