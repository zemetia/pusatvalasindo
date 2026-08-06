// ─── Hari kerja & alpha ─────────────────────────────────────────────────────
// Murni, tanpa impor Prisma, supaya dipakai bersama oleh perhitungan gaji di
// server DAN kalender kehadiran di slip. Kalau keduanya menghitung sendiri-
// sendiri, slip akan menampilkan jumlah hari alpha yang berbeda dari jumlah
// hari yang dipotong dari gajinya.
//
// Definisi alpha di sistem ini: HARI KERJA YANG SUDAH LEWAT TANPA SATU PUN
// BARIS PRESENSI. Baris presensi hanya lahir kalau karyawan absen sendiri atau
// HR mengisinya, jadi ketiadaan baris bukan "data belum masuk" — itu buktinya.
// Sebelumnya hanya baris ber-status ABSENT yang dipotong, sehingga tidak masuk
// tanpa mengabari siapa pun justru tidak berkonsekuensi apa-apa.

/**
 * Hari kerja standar sebulan — pembagi setiap angka "per hari" pada gaji.
 *
 * Angka tetap, bukan jumlah hari kerja bulan berjalan: upah harian yang
 * berubah-ubah tiap bulan membuat potongan untuk pelanggaran yang sama persis
 * berbeda nilainya antara Februari dan Agustus. Berdiri di atas asumsi Senin
 * s/d Sabtu (lihat `isWorkday`).
 */
export const WORK_DAYS_PER_MONTH = 24;

/**
 * Hari kerja = Senin s/d Sabtu, di luar tanggal merah.
 *
 * Minggu tidak dicatat sebagai tanggal merah — ia sudah bukan hari kerja di
 * sini. Pembagi `dailyRate` (24 hari sebulan) berdiri di atas asumsi yang sama.
 */
export function isWorkday(iso: string, holidays: ReadonlySet<string>): boolean {
  if (holidays.has(iso)) return false;
  // Tanggal ISO ditafsirkan sebagai UTC oleh Date, jadi harinya stabil di zona
  // waktu mana pun — yang dibandingkan cuma tanggal kalender, bukan instan.
  return new Date(`${iso}T00:00:00Z`).getUTCDay() !== 0;
}

/** Tanggal ISO (YYYY-MM-DD) untuk satu hari di bulan tertentu. */
export function isoOf(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Jumlah hari dalam satu bulan (month 1–12). */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Hari-hari pada satu periode yang dihitung ALPHA untuk seorang karyawan.
 *
 * Yang dikecualikan, dan alasannya:
 *   • hari yang punya baris presensi — status barisnya yang bicara, bukan
 *     ketiadaannya (termasuk HOLIDAY dan LEAVE yang diisi HR);
 *   • Minggu dan tanggal merah — bukan hari kerja;
 *   • hari ini dan sesudahnya — harinya belum selesai, belum absen jam 08.00
 *     bukan berarti tidak masuk;
 *   • hari sebelum karyawan bergabung — dia memang belum bekerja.
 */
export function deriveAlphaDays(params: {
  year: number;
  month: number;
  /** Tanggal ISO yang SUDAH punya baris presensi. */
  recordedDates: ReadonlySet<string>;
  /** Tanggal merah, ISO. */
  holidays: ReadonlySet<string>;
  /** Hari ini menurut WIB, ISO. Hari ini sendiri tidak pernah alpha. */
  todayIso: string;
  /** Tanggal masuk kerja, ISO. Null berarti tidak ada batas awal. */
  joinIso?: string | null;
}): string[] {
  const { year, month, recordedDates, holidays, todayIso, joinIso } = params;
  const alpha: string[] = [];

  for (let day = 1; day <= daysInMonth(year, month); day++) {
    const iso = isoOf(year, month, day);
    if (iso >= todayIso) break;
    if (joinIso && iso < joinIso) continue;
    if (recordedDates.has(iso)) continue;
    if (!isWorkday(iso, holidays)) continue;
    alpha.push(iso);
  }

  return alpha;
}
