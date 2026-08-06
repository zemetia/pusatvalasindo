// ─── Jam kerja & hitungan keterlambatan ─────────────────────────────────────
// Murni, tanpa impor Prisma, supaya bisa dipakai komponen client juga. Ambang
// keterlambatan hanya boleh ditulis sekali: server memakainya untuk menetapkan
// status LATE, rule payroll memakainya di SQL, dan slip memakainya untuk
// menampilkan berapa menit yang didendakan. Kalau tiga angka itu berbeda, slip
// akan menjelaskan denda dengan angka yang bukan dasar dendanya.

/**
 * Jam mulai kerja (WIB). Check-in SETELAH ini dihitung terlambat; tepat pada
 * jam ini masih tepat waktu.
 *
 * INI SATU-SATUNYA TEMPAT ANGKANYA DITULIS. Untuk mengubah jam masuk, ubah dua
 * baris di bawah dan tidak ada yang lain: label di UI, teks bantuan, dan SQL
 * rule denda semuanya diturunkan dari sini (lihat `WORK_START_LABEL` dan
 * `workStartSqlExpr()`). Yang tersisa hanyalah satu langkah yang tidak bisa
 * dilakukan dari kode — SQL rule yang SUDAH tersimpan di database perlu
 * disimpan ulang sebagai versi baru; lihat
 * prisma/scripts/apply-jam-masuk.ts.
 */
export const WORK_START_HOUR = 7;
export const WORK_START_MINUTE = 40;

/** Jam mulai kerja sebagai menit-dalam-hari WIB. */
export const WORK_START_MINUTES = WORK_START_HOUR * 60 + WORK_START_MINUTE;

/**
 * Jam masuk untuk ditampilkan ke pengguna — "07.30".
 *
 * Ada supaya tidak ada satu pun teks UI yang mengetik jamnya sendiri. Dulu
 * "17.40" tertulis manual di tiga tempat, jadi mengubah jam kerja berarti
 * memburu string di seluruh proyek — dan yang terlewat akan menjelaskan denda
 * dengan jam yang bukan dasar dendanya.
 */
export const WORK_START_LABEL = `${String(WORK_START_HOUR).padStart(2, "0")}.${String(
  WORK_START_MINUTE
).padStart(2, "0")}`;

/**
 * Ambang jam masuk sebagai ekspresi menit untuk disisipkan ke SQL rule denda.
 *
 * Dituliskan sebagai `(7 * 60 + 40)` — bentuk yang sama dengan yang selama ini
 * ditulis tangan di SQL — supaya rule yang tersimpan tetap terbaca manusia saat
 * dibuka di halaman "Rule Reward & Denda", bukan berupa angka 450 yang tidak
 * bisa ditelusuri asalnya.
 */
export function workStartSqlExpr(): string {
  return `(${WORK_START_HOUR} * 60 + ${WORK_START_MINUTE})`;
}

/**
 * Apakah satu baris presensi terlambat — DITURUNKAN dari `checkIn`, bukan dibaca
 * dari kolom `status`.
 *
 * Kolom `status` adalah potret: ia ditulis sekali saat presensi dicatat, memakai
 * ambang yang berlaku detik itu, lalu tidak pernah dihitung ulang. Membacanya
 * berarti memakai ambang lama tanpa sadar. Itu yang membuat baris 4 Juli dengan
 * jam masuk 06.56 tetap berstatus LATE — lalu didenda 0 menit karena nominalnya
 * dihitung dengan ambang baru — sementara 23 hari Agustus yang masuk 07.47
 * sampai 10.20 tersimpan PRESENT dan tidak pernah terlihat sama sekali.
 *
 * `checkIn` kosong adalah satu-satunya keadaan yang tidak bisa dihitung: hari
 * yang di-set manual oleh HR tanpa jam masuk. Di situ, dan HANYA di situ, kolom
 * status dipercaya — karena itu memang keputusan manusia, bukan potret ambang.
 */
export function isLateArrival(record: {
  status: string | null | undefined;
  checkIn: Date | null | undefined;
}): boolean {
  if (record.checkIn) return lateMinutesOf(record.checkIn) > 0;
  return record.status === "LATE";
}

/**
 * Menit keterlambatan sebuah baris presensi, konsisten dengan `isLateArrival`.
 *
 * Nol untuk baris yang tidak terlambat, dan nol untuk LATE-manual tanpa jam
 * masuk — sama seperti SQL rule denda, yang memperlakukan baris begitu sebagai
 * satu pelanggaran tanpa rupiah.
 */
export function lateMinutesOfRecord(record: {
  status: string | null | undefined;
  checkIn: Date | null | undefined;
}): number {
  return isLateArrival(record) ? lateMinutesOf(record.checkIn) : 0;
}

const JAKARTA_TIME = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Jakarta",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/**
 * Menit-dalam-hari menurut WIB.
 *
 * Sengaja tidak memakai `getHours()`: itu mengikuti zona waktu SERVER, jadi
 * instance yang berjalan di UTC (Vercel) akan menilai check-in 17.45 WIB
 * sebagai jam 10.45 dan menganggapnya tepat waktu. Di browser masalahnya sama,
 * cuma sumbernya zona waktu perangkat.
 */
export function jakartaMinutesOfDay(date: Date): number {
  const [hour, minute] = JAKARTA_TIME.format(date).split(":").map(Number);
  return hour * 60 + minute;
}

const JAKARTA_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Tanggal WIB sebagai "YYYY-MM-DD".
 *
 * Dipakai untuk memutuskan hari mana yang "sudah terlewat". `toISOString()`
 * memberi tanggal UTC — tujuh jam di belakang Jakarta — sehingga sebelum pukul
 * 07.00 WIB hari ini masih terbaca sebagai kemarin, dan hari yang belum
 * selesai bisa dinilai alpha.
 */
export function jakartaDateIso(date: Date = new Date()): string {
  return JAKARTA_DATE.format(date);
}

/** Jam masuk WIB sebagai "HH.MM" — bentuk yang dipakai di slip dan tooltip. */
export function formatJakartaTime(date: Date): string {
  return JAKARTA_TIME.format(date).replace(":", ".");
}

/**
 * Menit keterlambatan sebuah check-in. Nol kalau tepat waktu atau tanpa jam
 * masuk — persis seperti SQL rule `denda_keterlambatan`, yang memagari hasilnya
 * dengan `GREATEST(0, …)` dan memperlakukan `checkIn IS NULL` sebagai 0 menit.
 */
export function lateMinutesOf(checkIn: Date | null | undefined): number {
  if (!checkIn) return 0;
  return Math.max(0, jakartaMinutesOfDay(checkIn) - WORK_START_MINUTES);
}
