/**
 * Kolektor KPI otomatis — mengubah data modul lain menjadi entri KPI.
 *
 * Murni, tanpa akses database, supaya aturannya bisa diuji langsung. Yang
 * mengambil datanya adalah kpi-collector.service.ts.
 *
 * Dua alasan modul ini ada:
 *  1. KPI yang datanya sudah tersimpan di sistem tidak boleh diketik ulang
 *     manual — itu beban yang membuat penilaian berhenti diisi setelah
 *     beberapa bulan, dan KPI penalti yang kosong terbaca sebagai "sempurna".
 *  2. Penilaian atas kehadiran dan ketepatan closing sebaiknya tidak lewat
 *     tangan siapa pun; angkanya diambil apa adanya dari catatan absensi.
 *
 * Prinsip yang dipegang semua kolektor di sini: **hari yang datanya
 * meragukan tidak dihukum**, tapi dilaporkan lewat `skipped` agar atasan bisa
 * memutuskan sendiri. Menebak-nebak pelanggaran lebih berbahaya daripada
 * melewatkannya.
 */

import type { AttendanceStatus } from "@src/generated/prisma/client";
import { formatJakartaTime, isLateArrival, jakartaMinutesOfDay } from "./attendance-time";

/** Baris absensi yang dibutuhkan kolektor. */
export type AttendanceRecord = {
  /** Tanggal shift (bukan tanggal check-out, yang jatuh esok paginya). */
  date: Date;
  status: AttendanceStatus;
  checkIn: Date | null;
  checkOut: Date | null;
  isWithDoctorNote: boolean;
};

/** Satu entri KPI hasil turunan, siap disimpan oleh service. */
export type DerivedEntry = {
  occurredAt: Date;
  quantity: number;
  note: string;
};

/** Hari yang sengaja tidak dinilai, beserta alasannya. */
export type SkippedDay = {
  date: Date;
  reason: string;
};

export type CollectorOutput = {
  entries: DerivedEntry[];
  skipped: SkippedDay[];
};

/**
 * Bobot pelanggaran kedisiplinan, dinyatakan sebagai "berapa kali kejadian".
 * Poin per kejadian tetap disetel HR di konfigurasi KPI jabatan, jadi tabel ini
 * hanya mengatur berat relatif antar jenis pelanggaran.
 *
 * Sakit dan izin bersurat dokter sengaja bernilai 0: keduanya sudah dipotong di
 * payroll, dan menghitungnya lagi sebagai pelanggaran kedisiplinan berarti
 * menghukum orang dua kali untuk hal yang sama.
 */
export const DISCIPLINE_WEIGHTS = {
  LATE: 1,
  ABSENT: 3,
  /** Izin tanpa surat dokter. */
  PERMISSION_NO_NOTE: 2,
} as const;

const STATUS_LABELS: Record<string, string> = {
  LATE: "Terlambat",
  ABSENT: "Alpa",
  PERMISSION: "Izin",
  SICK: "Sakit",
  LEAVE: "Cuti",
  PRESENT: "Hadir",
  WFH: "WFH",
  HOLIDAY: "Libur",
};

/**
 * Tanggal shift berasal dari kolom `@db.Date` yang disimpan di UTC, jadi
 * dirender di UTC juga — tanpa itu, catatan "3 Jul" bisa tampil sebagai "2 Jul"
 * di server dengan offset negatif.
 */
function formatDate(date: Date) {
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/**
 * Keduanya WIB, bukan zona waktu proses.
 *
 * `getHours()` mengikuti zona waktu SERVER: di instance yang berjalan di UTC,
 * check-in 07.48 WIB terbaca 00.48 — jadi catatan KPI akan menyebut jam yang
 * bukan jam masuknya, dan batas closing dinilai tujuh jam meleset. Sejak
 * keterlambatan diturunkan lewat `isLateArrival` (yang sadar WIB), dua helper
 * ini harus memakai zona yang sama atau angkanya saling bertentangan.
 */
const formatTime = formatJakartaTime;
const minutesOfDay = jakartaMinutesOfDay;

/**
 * Kedisiplinan kehadiran → entri penalti per hari bermasalah.
 *
 * Nilai `quantity` adalah bobot dari DISCIPLINE_WEIGHTS, bukan selalu 1, supaya
 * alpa tidak dianggap sama ringannya dengan terlambat.
 */
export function collectAttendanceDiscipline(records: AttendanceRecord[]): CollectorOutput {
  const entries: DerivedEntry[] = [];
  const skipped: SkippedDay[] = [];

  for (const record of records) {
    // Diturunkan dari checkIn, bukan dari kolom status — supaya penalti KPI dan
    // denda payroll tidak pernah memakai ambang jam masuk yang berbeda.
    if (isLateArrival(record)) {
      const detail = record.checkIn ? ` (masuk ${formatTime(record.checkIn)})` : "";
      entries.push({
        occurredAt: record.date,
        quantity: DISCIPLINE_WEIGHTS.LATE,
        note: `${formatDate(record.date)}: terlambat${detail} — dari absensi`,
      });
      continue;
    }

    if (record.status === "ABSENT") {
      entries.push({
        occurredAt: record.date,
        quantity: DISCIPLINE_WEIGHTS.ABSENT,
        note: `${formatDate(record.date)}: alpa — dihitung ${DISCIPLINE_WEIGHTS.ABSENT}× pelanggaran, dari absensi`,
      });
      continue;
    }

    if (record.status === "PERMISSION") {
      if (record.isWithDoctorNote) {
        skipped.push({
          date: record.date,
          reason: "Izin dengan surat dokter — tidak dihitung sebagai pelanggaran kedisiplinan",
        });
        continue;
      }
      entries.push({
        occurredAt: record.date,
        quantity: DISCIPLINE_WEIGHTS.PERMISSION_NO_NOTE,
        note: `${formatDate(record.date)}: izin tanpa surat dokter — dihitung ${DISCIPLINE_WEIGHTS.PERMISSION_NO_NOTE}× pelanggaran, dari absensi`,
      });
      continue;
    }

    if (record.status === "SICK") {
      skipped.push({
        date: record.date,
        reason: "Sakit — sudah diperhitungkan di potongan gaji, bukan pelanggaran kedisiplinan",
      });
    }
  }

  return { entries, skipped };
}

export type ClosingConfig = {
  /** Batas jam closing dalam format "HH:MM" waktu setempat, mis. "05:15". */
  deadline: string;
  /** Toleransi setelah batas, dalam menit. Sheet KPI memakai 60 menit. */
  graceMinutes?: number;
};

const DEFAULT_CLOSING: Required<ClosingConfig> = { deadline: "05:15", graceMinutes: 60 };

/** Parse "HH:MM" jadi menit-dalam-hari; null bila formatnya tidak sah. */
export function parseClockTime(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/**
 * Ketepatan closing → satu entri penalti per hari yang lewat batas.
 *
 * Shift di sini berakhir pagi hari berikutnya (sheet KPI menyebut batas 05.15
 * untuk PVI dan 05.00 untuk PTU, dengan toleransi 1 jam), jadi yang
 * dibandingkan adalah jam pada `checkOut`, bukan selisih tanggalnya.
 */
export function collectClosingPunctuality(
  records: AttendanceRecord[],
  config?: Partial<ClosingConfig> | null
): CollectorOutput {
  const deadlineRaw = config?.deadline ?? DEFAULT_CLOSING.deadline;
  const deadlineMinutes = parseClockTime(deadlineRaw);
  const grace = config?.graceMinutes ?? DEFAULT_CLOSING.graceMinutes;

  if (deadlineMinutes === null) {
    // Konfigurasi salah tidak boleh diam-diam memakai default: seluruh periode
    // akan dinilai dengan batas yang bukan milik PT ini.
    throw new Error(
      `Batas jam closing "${deadlineRaw}" tidak sah — gunakan format HH:MM, misalnya "05:15"`
    );
  }

  const limitMinutes = deadlineMinutes + grace;
  const entries: DerivedEntry[] = [];
  const skipped: SkippedDay[] = [];

  for (const record of records) {
    // Cuti disamakan dengan libur: tidak ada shift yang bisa ditutup, jadi
    // menandainya "perlu diperiksa manual" hanya menambah bising.
    if (record.status === "HOLIDAY" || record.status === "ABSENT" || record.status === "LEAVE")
      continue;

    if (!record.checkOut) {
      // Lupa absen pulang bukan bukti closing terlambat. Menghukumnya di sini
      // berarti menghukum kelalaian alat, jadi diserahkan ke atasan.
      skipped.push({
        date: record.date,
        reason: "Tidak ada catatan absen pulang — perlu diperiksa manual",
      });
      continue;
    }

    const checkOutMinutes = minutesOfDay(record.checkOut);

    // Shift malam: closing yang wajar jatuh di pagi hari. Check-out di luar
    // pola itu (mis. siang atau sore) berarti datanya tidak bisa dibaca dengan
    // aturan ini.
    if (checkOutMinutes > 12 * 60) {
      skipped.push({
        date: record.date,
        reason: `Absen pulang jam ${formatTime(record.checkOut)} — di luar pola shift, perlu diperiksa manual`,
      });
      continue;
    }

    if (checkOutMinutes > limitMinutes) {
      const lateBy = checkOutMinutes - limitMinutes;
      entries.push({
        occurredAt: record.date,
        quantity: 1,
        note: `${formatDate(record.date)}: closing jam ${formatTime(record.checkOut)}, lewat ${lateBy} menit dari batas ${deadlineRaw} + toleransi ${grace} menit — dari absensi`,
      });
    }
  }

  return { entries, skipped };
}

/** Kunci kolektor yang dikenali, dipetakan dari KpiDefinition.systemSourceKey. */
export const COLLECTOR_KEYS = {
  ATTENDANCE_LATE: "ATTENDANCE_LATE",
  ATTENDANCE_CLOSING: "ATTENDANCE_CLOSING",
} as const;

export type CollectorKey = (typeof COLLECTOR_KEYS)[keyof typeof COLLECTOR_KEYS];

export const COLLECTOR_LABELS: Record<string, string> = {
  ATTENDANCE_LATE: "Kedisiplinan dari absensi",
  ATTENDANCE_CLOSING: "Ketepatan closing dari absen pulang",
};

export function isKnownCollector(key: string | null | undefined): key is CollectorKey {
  return !!key && key in COLLECTOR_KEYS;
}

/**
 * Jalankan kolektor sesuai kuncinya.
 * Kunci yang belum dikenali dilempar, bukan didiamkan — KPI bersumber SYSTEM
 * yang tidak punya kolektor akan selamanya bernilai kosong tanpa ada yang tahu.
 */
export function runCollector(
  key: CollectorKey,
  records: AttendanceRecord[],
  config?: unknown
): CollectorOutput {
  switch (key) {
    case "ATTENDANCE_LATE":
      return collectAttendanceDiscipline(records);
    case "ATTENDANCE_CLOSING":
      return collectClosingPunctuality(records, (config ?? null) as Partial<ClosingConfig> | null);
    default: {
      const exhaustive: never = key;
      throw new Error(`Kolektor "${String(exhaustive)}" belum tersedia`);
    }
  }
}

export { STATUS_LABELS as ATTENDANCE_STATUS_LABELS };
