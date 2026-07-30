// ─── Aturan kehadiran yang dipakai bersama ──────────────────────────────────
// Ambang keterlambatan dulu ditulis ulang di /api/attendance; sekarang satu
// tempat, supaya presensi mandiri dan presensi manual oleh HR tidak bisa
// menilai jam masuk yang sama dengan hasil berbeda.

import { AttendanceStatus } from "@src/generated/prisma";

/** Jam mulai kerja (WIB). Check-in setelah ini dihitung terlambat. */
export const WORK_START_HOUR = 17;
export const WORK_START_MINUTE = 40;

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
 * sebagai jam 10.45 dan menganggapnya tepat waktu.
 */
export function jakartaMinutesOfDay(date: Date): number {
  const [hour, minute] = JAKARTA_TIME.format(date).split(":").map(Number);
  return hour * 60 + minute;
}

/** PRESENT atau LATE, berdasarkan jam masuk. */
export function resolveArrivalStatus(checkIn: Date): AttendanceStatus {
  const limit = WORK_START_HOUR * 60 + WORK_START_MINUTE;
  return jakartaMinutesOfDay(checkIn) > limit
    ? AttendanceStatus.LATE
    : AttendanceStatus.PRESENT;
}
