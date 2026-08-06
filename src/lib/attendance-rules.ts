// ─── Aturan kehadiran yang dipakai bersama ──────────────────────────────────
// Ambang keterlambatan dulu ditulis ulang di /api/attendance; sekarang satu
// tempat, supaya presensi mandiri dan presensi manual oleh HR tidak bisa
// menilai jam masuk yang sama dengan hasil berbeda.
//
// Angka jam kerja dan hitungan menitnya sendiri tinggal di `attendance-time.ts`
// — modul ini menambahkan status Prisma di atasnya, dan impor itu yang membuat
// file ini tidak aman dipakai dari komponen client.

import { AttendanceStatus } from "@src/generated/prisma";
import { WORK_START_MINUTES, jakartaMinutesOfDay } from "./attendance-time";

export {
  WORK_START_HOUR,
  WORK_START_MINUTE,
  WORK_START_MINUTES,
  jakartaMinutesOfDay,
  lateMinutesOf,
} from "./attendance-time";

/** PRESENT atau LATE, berdasarkan jam masuk. */
export function resolveArrivalStatus(checkIn: Date): AttendanceStatus {
  return jakartaMinutesOfDay(checkIn) > WORK_START_MINUTES
    ? AttendanceStatus.LATE
    : AttendanceStatus.PRESENT;
}
