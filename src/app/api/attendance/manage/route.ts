// ─── Koreksi presensi karyawan lain (halaman KPI › Presensi Karyawan) ───────
// Berbeda dari /api/attendance yang hanya melayani presensi MILIK SENDIRI
// (`attendance.self`). Semua aksi di sini butuh `attendance.all` + PT karyawan
// harus masuk scope tulis si pemanggil — jadi HR satu PT tidak bisa mengoreksi
// kehadiran karyawan PT lain hanya dengan mengganti `userId` di body.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { AttendanceStatus } from "@src/generated/prisma";
import { authorize } from "@/backend/helpers/authz";
import { ok, fail } from "@/backend/helpers/api-response";
import { todayKeyJakarta } from "@/lib/finance-period";
import { resolveArrivalStatus } from "@/lib/attendance-rules";

const STATUSES = Object.values(AttendanceStatus) as string[];

/** `YYYY-MM-DD` → tengah malam UTC, sama seperti penyimpanan kolom `@db.Date`. */
function parseDateKey(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * ISO string → Date. Tiga hasil yang berbeda dan disengaja:
 *   • `undefined` — tidak dikirim, jangan diubah
 *   • `null`      — dikirim kosong, artinya hapus jamnya
 *   • `Date`      — nilai baru
 * `"invalid"` dikembalikan terpisah supaya jam yang salah format ditolak,
 * bukan diam-diam diabaikan sehingga penggunanya mengira sudah tersimpan.
 */
function parseInstant(value: unknown): Date | null | undefined | "invalid" {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") return "invalid";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "invalid" : date;
}

type Body = {
  userId?: string;
  date?: string;
  status?: string;
  /** ISO lengkap; null = hapus jam masuk. */
  checkIn?: string | null;
  /** ISO lengkap; null = hapus jam pulang. */
  checkOut?: string | null;
  notes?: string | null;
  isWithDoctorNote?: boolean;
};

export async function PATCH(req: NextRequest) {
  const authz = await authorize("attendance.all", "write");
  if (authz instanceof NextResponse) return authz;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json(fail("BAD_REQUEST", "Body tidak sah"), { status: 400 });
  }

  const { userId } = body;
  const dateKey = body.date;
  const date = parseDateKey(dateKey);
  if (!userId || !dateKey || !date) {
    return NextResponse.json(
      fail("BAD_REQUEST", "userId dan date (YYYY-MM-DD) wajib diisi"),
      { status: 400 }
    );
  }

  if (body.status !== undefined && !STATUSES.includes(body.status)) {
    return NextResponse.json(fail("BAD_REQUEST", "Status tidak dikenal"), { status: 400 });
  }

  // Koreksi hanya untuk hari yang sudah lewat atau hari ini. Menulis presensi
  // ke tanggal masa depan berarti kehadiran "tercatat" sebelum terjadi, dan
  // angka itu langsung masuk ke potongan gaji serta skor KPI.
  // "Hari ini" menurut WIB, bukan jam server — kalau tidak, antara 00:00–07:00
  // WIB koreksi untuk hari berjalan akan ditolak sebagai "masa depan".
  if (dateKey > todayKeyJakarta()) {
    return NextResponse.json(
      fail("BAD_REQUEST", "Tidak bisa mencatat presensi untuk tanggal yang belum terjadi"),
      { status: 400 }
    );
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, branchId: true, branch: { select: { companyId: true } } },
  });
  if (!target) {
    return NextResponse.json(fail("NOT_FOUND", "Karyawan tidak ditemukan"), { status: 404 });
  }
  if (!authz.canWrite(target.branch?.companyId ?? null)) {
    return NextResponse.json(
      fail("FORBIDDEN", "Anda tidak memiliki izin untuk PT karyawan ini"),
      { status: 403 }
    );
  }

  const existing = await prisma.attendance.findUnique({
    where: { userId_date: { userId, date } },
    select: { checkIn: true, checkOut: true, status: true },
  });

  const checkIn = parseInstant(body.checkIn);
  const checkOut = parseInstant(body.checkOut);
  if (checkIn === "invalid" || checkOut === "invalid") {
    return NextResponse.json(
      fail("BAD_REQUEST", "Jam masuk/pulang harus berupa waktu ISO yang sah"),
      { status: 400 }
    );
  }

  // Urutan waktu diperiksa terhadap nilai AKHIR, bukan hanya yang dikirim —
  // mengubah jam masuk saja tetap bisa membuatnya melewati jam pulang lama.
  const finalCheckIn = checkIn !== undefined ? checkIn : (existing?.checkIn ?? null);
  const finalCheckOut = checkOut !== undefined ? checkOut : (existing?.checkOut ?? null);
  if (finalCheckIn && finalCheckOut && finalCheckOut <= finalCheckIn) {
    return NextResponse.json(
      fail("BAD_REQUEST", "Jam pulang harus setelah jam masuk"),
      { status: 400 }
    );
  }
  if (!finalCheckIn && finalCheckOut) {
    return NextResponse.json(
      fail("BAD_REQUEST", "Jam pulang tidak bisa diisi tanpa jam masuk"),
      { status: 400 }
    );
  }

  // Presensi manual tanpa status eksplisit dinilai dengan aturan yang sama
  // seperti clock-in mandiri — kalau tidak, mencatatkan orang yang terlambat
  // lewat halaman ini diam-diam menghapus keterlambatannya. Status non-kehadiran
  // (sakit, cuti, izin, libur) tidak pernah ditimpa otomatis.
  const autoStatus =
    body.status === undefined &&
    finalCheckIn &&
    (existing == null ||
      existing.status === AttendanceStatus.PRESENT ||
      existing.status === AttendanceStatus.LATE)
      ? resolveArrivalStatus(finalCheckIn)
      : undefined;

  const status = (body.status as AttendanceStatus | undefined) ?? autoStatus;

  const audit = { editedById: authz.userId, editedAt: new Date() };
  const mutable = {
    ...(status !== undefined ? { status } : {}),
    ...(checkIn !== undefined ? { checkIn } : {}),
    ...(checkOut !== undefined ? { checkOut } : {}),
    ...(body.notes !== undefined ? { notes: body.notes || null } : {}),
    ...(body.isWithDoctorNote !== undefined
      ? { isWithDoctorNote: body.isWithDoctorNote }
      : {}),
  };

  const record = await prisma.attendance.upsert({
    where: { userId_date: { userId, date } },
    create: {
      userId,
      date,
      // Cabang ikut disimpan supaya laporan per cabang tetap benar walau
      // karyawan dipindahkan setelah tanggal itu.
      branchId: target.branchId,
      status: status ?? AttendanceStatus.PRESENT,
      checkIn: checkIn ?? null,
      checkOut: checkOut ?? null,
      notes: body.notes || null,
      isWithDoctorNote: body.isWithDoctorNote ?? false,
      ...audit,
    },
    update: { ...mutable, ...audit },
    select: {
      id: true,
      userId: true,
      date: true,
      status: true,
      checkIn: true,
      checkOut: true,
      notes: true,
      isWithDoctorNote: true,
      isLocationSuspect: true,
      editedAt: true,
      editedBy: { select: { name: true } },
    },
  });

  return NextResponse.json(ok(record));
}

/**
 * Hapus catatan presensi satu karyawan pada satu tanggal — mengembalikannya ke
 * keadaan "belum ada catatan", bukan menandainya alpa. Dipakai saat catatannya
 * memang salah orang atau salah tanggal; menandai alpa dilakukan lewat PATCH.
 */
export async function DELETE(req: NextRequest) {
  const authz = await authorize("attendance.all", "write");
  if (authz instanceof NextResponse) return authz;

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const dateKey = searchParams.get("date");
  const date = parseDateKey(dateKey);
  if (!userId || !date) {
    return NextResponse.json(
      fail("BAD_REQUEST", "userId dan date (YYYY-MM-DD) wajib diisi"),
      { status: 400 }
    );
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { branch: { select: { companyId: true } } },
  });
  if (!target) {
    return NextResponse.json(fail("NOT_FOUND", "Karyawan tidak ditemukan"), { status: 404 });
  }
  if (!authz.canWrite(target.branch?.companyId ?? null)) {
    return NextResponse.json(
      fail("FORBIDDEN", "Anda tidak memiliki izin untuk PT karyawan ini"),
      { status: 403 }
    );
  }

  // `deleteMany` bukan `delete`: menghapus catatan yang memang sudah tidak ada
  // bukan kesalahan yang perlu dilaporkan ke pengguna.
  const { count } = await prisma.attendance.deleteMany({
    where: { userId, date },
  });

  return NextResponse.json(ok({ deleted: count }));
}
