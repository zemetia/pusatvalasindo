// Tanggal merah untuk satu bulan.
//
// Dibaca kalender kehadiran di slip gaji supaya hari libur nasional tidak
// tampil sebagai alpha — aturan yang sama dengan yang dipakai perhitungan gaji
// di server (src/lib/workday.ts). Kalau halaman menghitungnya sendiri tanpa
// daftar ini, slip akan menuduh alpha di hari yang tidak dipotong sepeser pun.
//
// Isinya bukan data pribadi siapa pun — cukup sesi yang sah, tanpa izin
// khusus. Yang dijaga di sini hanya bentuk parameternya.

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { handleError } from "@/backend/helpers/handle-error";

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = Number(searchParams.get("month"));
  const year = Number(searchParams.get("year"));

  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year)) {
    return NextResponse.json({ error: "month (1-12) dan year wajib diisi" }, { status: 400 });
  }

  try {
    const holidays = await prisma.publicHoliday.findMany({
      where: {
        date: {
          gte: new Date(Date.UTC(year, month - 1, 1)),
          lte: new Date(Date.UTC(year, month, 0)),
        },
      },
      orderBy: { date: "asc" },
      select: { date: true, name: true, isJointLeave: true },
    });

    return NextResponse.json(
      holidays.map((h) => ({
        // Tanggal saja (kolomnya @db.Date) — jam tidak punya arti di sini dan
        // hanya akan menggeser hari saat di-parse di zona waktu lain.
        date: h.date.toISOString().slice(0, 10),
        name: h.name,
        isJointLeave: h.isJointLeave,
      }))
    );
  } catch (e) {
    // Tanpa ini, kegagalan di sini keluar sebagai 500 kosong tanpa pesan —
    // persis yang bikin susah waktu model PublicHoliday belum ada di Prisma
    // client yang sedang dipakai proses dev (perlu restart setelah generate).
    return handleError(e);
  }
}
