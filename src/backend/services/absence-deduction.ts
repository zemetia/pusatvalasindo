// ─── Potongan ketidakhadiran ────────────────────────────────────────────────
// Satu tempat untuk seluruh tarif potongan sakit / izin / cuti / alpha.
//
// Murni: tidak menyentuh Prisma, tidak membaca jam, tidak tahu siapa
// karyawannya. Semua yang dibutuhkannya masuk lewat argumen, sehingga
// kebijakannya bisa diuji langsung dengan angka — sebelumnya aturan ini hidup
// sebagai rantai if di tengah `calculateMonthlyPayroll` dan satu-satunya cara
// memeriksanya adalah menjalankan payroll sungguhan.
//
// KEBIJAKAN YANG BERLAKU, ditetapkan manajemen 6 Agustus 2026:
//
//   Sakit + surat dokter   1× upah harian
//   Sakit tanpa surat      2× upah harian
//   Izin                   1× upah harian   (surat dokter tidak berlaku di sini)
//   Cuti resmi             uang makan + transport hari itu saja
//   Alpha                  2× upah harian   — sama untuk yang dicatat HR maupun
//                          hari kerja yang lewat tanpa baris presensi
//
// Angka-angka ini masih hidup di kode, BUKAN di tabel PayrollRule — HR belum
// bisa mengubahnya sendiri dari halaman "Rule Reward & Denda". Denda
// keterlambatan sudah pindah ke sana; ini belum.

/** Pengali upah harian per kategori. Satu-satunya tempat angkanya ditulis. */
export const ABSENCE_MULTIPLIER = {
  sakitBersurat: 1,
  sakitTanpaSurat: 2,
  izin: 1,
  alpha: 2,
} as const;

/** Bentuk minimal baris presensi yang dibutuhkan — sengaja bukan tipe Prisma. */
export type AbsenceRecord = {
  status: string;
  isWithDoctorNote: boolean;
};

export type AbsenceDays = {
  sakit: number;
  sakitTanpaSurat: number;
  izin: number;
  cuti: number;
  alphaTercatat: number;
  /** Hari kerja lewat tanpa baris presensi sama sekali. */
  alphaTanpaCatatan: number;
};

/**
 * Total potongan ketidakhadiran beserta rincian jumlah harinya.
 *
 * `dailyRate` adalah upah harian penuh (gaji kotor ÷ hari kerja standar),
 * `dailyFieldAllowance` hanya uang makan + transport per hari — dipakai khusus
 * untuk cuti, yang tetap dibayar selain ongkos hariannya.
 */
export function computeAbsenceDeduction(params: {
  records: AbsenceRecord[];
  /** Jumlah hari kerja lewat tanpa baris presensi (alpha turunan). */
  alphaWithoutRecord: number;
  dailyRate: number;
  dailyFieldAllowance: number;
}): { total: number; days: AbsenceDays } {
  const { records, alphaWithoutRecord, dailyRate, dailyFieldAllowance } = params;

  const days: AbsenceDays = {
    sakit: 0,
    sakitTanpaSurat: 0,
    izin: 0,
    cuti: 0,
    alphaTercatat: 0,
    alphaTanpaCatatan: alphaWithoutRecord,
  };

  for (const r of records) {
    switch (r.status) {
      case "SICK":
        // Surat dokter berlaku pada status yang tepat. Sebelum 6 Agustus 2026
        // `isWithDoctorNote` justru dibaca pada IZIN dan diabaikan pada SAKIT,
        // sehingga sakit dengan surat dan tanpa surat dipotong sama besar.
        if (r.isWithDoctorNote) days.sakit++;
        else days.sakitTanpaSurat++;
        break;
      case "PERMISSION":
        days.izin++;
        break;
      case "LEAVE":
        days.cuti++;
        break;
      case "ABSENT":
        days.alphaTercatat++;
        break;
      // PRESENT, LATE, WFH, HOLIDAY tidak memotong apa pun. Keterlambatan
      // ditangani rule `denda_keterlambatan`, bukan di sini.
    }
  }

  const total =
    days.sakit * ABSENCE_MULTIPLIER.sakitBersurat * dailyRate +
    days.sakitTanpaSurat * ABSENCE_MULTIPLIER.sakitTanpaSurat * dailyRate +
    days.izin * ABSENCE_MULTIPLIER.izin * dailyRate +
    days.cuti * dailyFieldAllowance +
    (days.alphaTercatat + days.alphaTanpaCatatan) * ABSENCE_MULTIPLIER.alpha * dailyRate;

  return { total, days };
}
