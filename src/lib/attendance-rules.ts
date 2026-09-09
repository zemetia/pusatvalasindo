// ─── Aturan kehadiran yang dipakai bersama ──────────────────────────────────
// Ambang keterlambatan dulu ditulis ulang di /api/attendance; sekarang satu
// tempat, supaya presensi mandiri dan presensi manual oleh HR tidak bisa
// menilai jam masuk yang sama dengan hasil berbeda.
//
// Angka jam kerja dan hitungan menitnya sendiri tinggal di `attendance-time.ts`
// — modul ini menambahkan status Prisma di atasnya, dan impor itu yang membuat
// file ini tidak aman dipakai dari komponen client.

import { AttendanceStatus } from "@src/generated/prisma";
import { classifyWorkStartRole, jakartaMinutesOfDay, workStartMinutesFor } from "./attendance-time";

export {
  classifyWorkStartRole,
  jakartaMinutesOfDay,
  lateMinutesOf,
  workStartLabelFor,
  workStartMinutesFor,
  workStartSqlExprFor,
  type WorkStartRole,
} from "./attendance-time";

/**
 * PRESENT atau LATE, berdasarkan jam masuk dan nama jabatan (`custom_role.name`).
 *
 * Nama jabatan diklasifikasi lewat `classifyWorkStartRole` — jabatan yang tidak
 * dikenali jatuh ke ambang Karyawan (07.55), bukan Kepala Cabang (07.30), supaya
 * jabatan yang belum terdaftar tidak diam-diam didenda dengan ambang yang lebih
 * ketat.
 */
export function resolveArrivalStatus(
  checkIn: Date,
  roleName: string | null | undefined
): AttendanceStatus {
  const role = classifyWorkStartRole(roleName);
  return jakartaMinutesOfDay(checkIn) > workStartMinutesFor(role)
    ? AttendanceStatus.LATE
    : AttendanceStatus.PRESENT;
}
