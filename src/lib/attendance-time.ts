// ─── Jam kerja & hitungan keterlambatan ─────────────────────────────────────
// Murni, tanpa impor Prisma, supaya bisa dipakai komponen client juga. Ambang
// keterlambatan hanya boleh ditulis sekali per jabatan: server memakainya
// untuk menetapkan status LATE, rule payroll memakainya di SQL, dan slip
// memakainya untuk menampilkan berapa menit yang didendakan. Kalau angka itu
// berbeda antar tempat, slip akan menjelaskan denda dengan angka yang bukan
// dasar dendanya.

/** Dua ambang jam masuk yang berlaku — bukan per jabatan individual, supaya
 *  daftarnya tetap pendek dan tidak perlu disentuh tiap kali ada jabatan baru. */
export type WorkStartRole = "KEPALA_CABANG" | "KARYAWAN";

/**
 * Nama jabatan (persis `custom_role.name`, dicocokkan tanpa peduli besar/kecil
 * huruf maupun spasi di ujung) yang memakai ambang Kepala Cabang.
 *
 * "Kepala & Kasir" ikut di sini karena `ROLE_PERMISSION_MAP` di lib/permissions.ts
 * sudah memetakan jabatan itu ke izin yang SAMA dengan "Kepala Cabang" — dua
 * nama untuk peran yang sama, bukan jabatan tersendiri. Jabatan lain yang
 * "setara" secara wewenang (mis. Kepala Marketing) SENGAJA tidak ikut: ambang
 * jam masuk ini soal jam datang ke kantor, bukan cakupan izin, dan belum ada
 * keputusan eksplisit untuk menyamakannya.
 */
const KEPALA_CABANG_ROLE_NAMES = new Set(["KEPALA CABANG", "KEPALA & KASIR"]);

/** Nama jabatan → ambang jam masuk mana yang berlaku. Karyawan adalah default
 *  untuk jabatan apa pun yang tidak ada di `KEPALA_CABANG_ROLE_NAMES`, termasuk
 *  saat jabatannya kosong/tidak diketahui — fail-safe ke ambang yang LEBIH
 *  longgar, bukan ke arah yang mendenda orang yang belum tentu Kepala Cabang. */
export function classifyWorkStartRole(roleName: string | null | undefined): WorkStartRole {
  if (!roleName) return "KARYAWAN";
  return KEPALA_CABANG_ROLE_NAMES.has(roleName.trim().toUpperCase())
    ? "KEPALA_CABANG"
    : "KARYAWAN";
}

type WorkStart = { hour: number; minute: number };

/**
 * Jam mulai kerja (WIB) per ambang. Check-in SETELAH ini dihitung terlambat;
 * tepat pada jam ini masih tepat waktu.
 *
 * INI SATU-SATUNYA TEMPAT ANGKANYA DITULIS. Untuk mengubah jam masuk, ubah di
 * sini dan tidak ada yang lain: label di UI, teks bantuan, dan SQL rule denda
 * semuanya diturunkan dari sini (lihat `workStartLabelFor()` dan
 * `workStartSqlExprFor()`). Yang tersisa hanyalah satu langkah yang tidak bisa
 * dilakukan dari kode — SQL rule yang SUDAH tersimpan di database perlu
 * disimpan ulang sebagai versi baru; lihat prisma/scripts/apply-jam-masuk.ts.
 */
export const WORK_START: Record<WorkStartRole, WorkStart> = {
  KEPALA_CABANG: { hour: 7, minute: 30 },
  KARYAWAN: { hour: 7, minute: 55 },
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Jam mulai kerja sebagai menit-dalam-hari WIB, untuk ambang yang diberikan. */
export function workStartMinutesFor(role: WorkStartRole): number {
  const w = WORK_START[role];
  return w.hour * 60 + w.minute;
}

/**
 * Jam masuk untuk ditampilkan ke pengguna — "07.30" atau "07.55".
 *
 * Ada supaya tidak ada satu pun teks UI yang mengetik jamnya sendiri.
 */
export function workStartLabelFor(role: WorkStartRole): string {
  const w = WORK_START[role];
  return `${pad2(w.hour)}.${pad2(w.minute)}`;
}

/**
 * Ambang jam masuk sebagai ekspresi menit untuk disisipkan ke SQL rule denda.
 *
 * Dituliskan sebagai `(7 * 60 + 30)` — bentuk yang sama dengan yang selama ini
 * ditulis tangan di SQL — supaya rule yang tersimpan tetap terbaca manusia saat
 * dibuka di halaman "Rule Reward & Denda", bukan berupa angka mentah yang
 * tidak bisa ditelusuri asalnya.
 */
export function workStartSqlExprFor(role: WorkStartRole): string {
  const w = WORK_START[role];
  return `(${w.hour} * 60 + ${w.minute})`;
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
 *
 * `role` WAJIB diisi oleh pemanggil (bukan default diam-diam) — dua ambang
 * berbeda sekarang berlaku, jadi menebak salah satu berarti menilai jam masuk
 * seseorang dengan ambang milik jabatan orang lain.
 */
export function isLateArrival(
  record: {
    status: string | null | undefined;
    checkIn: Date | null | undefined;
  },
  role: WorkStartRole
): boolean {
  if (record.checkIn) return lateMinutesOf(record.checkIn, role) > 0;
  return record.status === "LATE";
}

/**
 * Menit keterlambatan sebuah baris presensi, konsisten dengan `isLateArrival`.
 *
 * Nol untuk baris yang tidak terlambat, dan nol untuk LATE-manual tanpa jam
 * masuk — sama seperti SQL rule denda, yang memperlakukan baris begitu sebagai
 * satu pelanggaran tanpa rupiah.
 */
export function lateMinutesOfRecord(
  record: {
    status: string | null | undefined;
    checkIn: Date | null | undefined;
  },
  role: WorkStartRole
): number {
  return isLateArrival(record, role) ? lateMinutesOf(record.checkIn, role) : 0;
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
 * Jam WIB sebagai "HH:mm" (titik dua) — dipakai halaman presensi karyawan
 * sendiri, yang labelnya sudah menulis "HH:mm" di seluruh UI-nya.
 *
 * Sengaja bukan zona waktu PERANGKAT: laptop yang jamnya di-set UTC (atau
 * pengguna yang belum menyesuaikan jam) tetap harus melihat jam presensinya
 * sendiri sebagai WIB, persis seperti alasan `jakartaMinutesOfDay` di atas.
 */
export function formatJakartaHm(date: Date): string {
  return JAKARTA_TIME.format(date);
}

/**
 * Menit keterlambatan sebuah check-in. Nol kalau tepat waktu atau tanpa jam
 * masuk — persis seperti SQL rule `denda_keterlambatan`, yang memagari hasilnya
 * dengan `GREATEST(0, …)` dan memperlakukan `checkIn IS NULL` sebagai 0 menit.
 */
export function lateMinutesOf(checkIn: Date | null | undefined, role: WorkStartRole): number {
  if (!checkIn) return 0;
  return Math.max(0, jakartaMinutesOfDay(checkIn) - workStartMinutesFor(role));
}
