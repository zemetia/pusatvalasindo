import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { resolveArrivalStatus } from "@/lib/attendance-rules";
import { authorize } from "@/backend/helpers/authz";
import { userService } from "@/backend/services/user.service";

// Flag as suspicious if GPS and manual location differ by more than this (km)
const LOCATION_SUSPECT_THRESHOLD_KM = 0.5;

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function POST(req: NextRequest) {
  // Clock-in menulis presensi MILIK SENDIRI — resource `attendance.self`, yang
  // memang tanpa dimensi PT. Sebelumnya cukup "punya sesi", jadi mencabut
  // Presensi di matriks hanya menyembunyikan menunya, bukan menutup aksinya.
  const authz = await authorize("attendance.self", "write");
  if (authz instanceof NextResponse) return authz;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    date,
    checkIn,
    checkInPhotoUrl,
    checkInGpsLat,
    checkInGpsLng,
    checkInManualLat,
    checkInManualLng,
    notes,
  } = body as {
    date: string;
    checkIn: string;
    checkInPhotoUrl?: string;
    checkInGpsLat?: number;
    checkInGpsLng?: number;
    checkInManualLat?: number;
    checkInManualLng?: number;
    notes?: string;
  };

  if (!date || !checkIn) {
    return NextResponse.json(
      { error: "date and checkIn are required" },
      { status: 400 }
    );
  }

  // Geofence validation: patokannya cuma "sedang berada di kantor". Karyawan
  // boleh absen di cabang mana pun — termasuk cabang milik PT lain (pegawai
  // PTU absen di kantor PVI, dan sebaliknya) — asal masuk radius SALAH SATU
  // cabang aktif yang punya geofence. Cabang yang cocok dicatat ke
  // checkInBranchId di bawah, jadi kalau absennya di luar cabang profilnya
  // tetap kelihatan di halaman Presensi. Lookup jalan terlepas dari GPS
  // dikirim atau tidak, supaya request tanpa checkInGpsLat/Lng tidak
  // diam-diam lolos dari pemeriksaan.
  const userWithBranch = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { branchId: true },
  });

  let checkInBranchId: string | null = userWithBranch?.branchId ?? null;

  {
    const geofencedBranches = await prisma.branch.findMany({
      where: {
        isActive: true,
        latitude: { not: null },
        longitude: { not: null },
      },
      select: { id: true, name: true, latitude: true, longitude: true, attendanceRadiusM: true },
    });

    if (geofencedBranches.length > 0) {
      if (checkInGpsLat == null || checkInGpsLng == null) {
        return NextResponse.json(
          { error: "Lokasi GPS wajib diaktifkan untuk absen." },
          { status: 403 }
        );
      }

      const withDistance = geofencedBranches
        .map((b) => ({
          ...b,
          distM: haversineKm(checkInGpsLat, checkInGpsLng, b.latitude!, b.longitude!) * 1000,
        }))
        .sort((a, b) => a.distM - b.distM);

      const nearest = withDistance[0];
      const matched = withDistance.find((b) => b.distM <= (b.attendanceRadiusM ?? 20));

      if (!matched) {
        return NextResponse.json(
          {
            error: `Anda berada ${Math.round(nearest.distM)} m dari kantor terdekat (${nearest.name}). Absensi hanya diizinkan dari dalam area kantor.`,
            distanceM: Math.round(nearest.distM),
            nearestBranch: nearest.name,
          },
          { status: 403 }
        );
      }

      checkInBranchId = matched.id;
    }
  }

  const checkInTime = new Date(checkIn);
  const status = resolveArrivalStatus(checkInTime);

  let isLocationSuspect = false;
  if (
    checkInGpsLat != null &&
    checkInGpsLng != null &&
    checkInManualLat != null &&
    checkInManualLng != null
  ) {
    const dist = haversineKm(
      checkInGpsLat,
      checkInGpsLng,
      checkInManualLat,
      checkInManualLng
    );
    isLocationSuspect = dist > LOCATION_SUSPECT_THRESHOLD_KM;
  }

  const attendance = await prisma.attendance.upsert({
    where: {
      userId_date: {
        userId: session.user.id,
        date: new Date(date),
      },
    },
    create: {
      userId: session.user.id,
      date: new Date(date),
      checkIn: checkInTime,
      checkInPhotoUrl,
      checkInGpsLat,
      checkInGpsLng,
      checkInManualLat,
      checkInManualLng,
      checkInBranchId,
      isLocationSuspect,
      status,
      notes,
    },
    update: {
      checkIn: checkInTime,
      checkInPhotoUrl,
      checkInGpsLat,
      checkInGpsLng,
      checkInManualLat,
      checkInManualLng,
      checkInBranchId,
      isLocationSuspect,
      status,
      notes,
    },
  });

  return NextResponse.json(attendance, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  // Clock-out: sama seperti POST, menulis presensi sendiri.
  const authz = await authorize("attendance.self", "write");
  if (authz instanceof NextResponse) return authz;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { date, checkOut, checkOutPhotoUrl } = body as {
      date: string;
      checkOut: string;
      checkOutPhotoUrl?: string;
    };

    if (!date || !checkOut) {
      return NextResponse.json(
        { error: "date and checkOut are required" },
        { status: 400 }
      );
    }

    const existing = await prisma.attendance.findUnique({
      where: { userId_date: { userId: session.user.id, date: new Date(date) } },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "No check-in record found for today" },
        { status: 404 }
      );
    }

    if (!existing.checkIn) {
      return NextResponse.json(
        { error: "Cannot check out without checking in first" },
        { status: 400 }
      );
    }

    if (existing.checkOut) {
      return NextResponse.json(
        { error: "Already checked out today" },
        { status: 409 }
      );
    }

    const checkOutTime = new Date(checkOut);
    if (checkOutTime <= existing.checkIn) {
      return NextResponse.json(
        { error: "Check-out time must be after check-in time" },
        { status: 400 }
      );
    }

    const updated = await prisma.attendance.update({
      where: { userId_date: { userId: session.user.id, date: new Date(date) } },
      data: { checkOut: checkOutTime, checkOutPhotoUrl },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[PATCH /api/attendance]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server." }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const year = searchParams.get("year");
  const userId = searchParams.get("userId") ?? session.user.id;

  if (userId === session.user.id) {
    // Presensi sendiri.
    const authz = await authorize("attendance.self", "view");
    if (authz instanceof NextResponse) return authz;
  } else {
    // Presensi orang lain. Dulu `?userId=` menerima id siapa pun tanpa
    // pemeriksaan apa pun — siapa saja yang login bisa membaca riwayat
    // kehadiran seluruh karyawan. Sekarang butuh `attendance.all`, DAN PT
    // karyawan itu harus masuk scope bacanya.
    const authz = await authorize("attendance.all", "view");
    if (authz instanceof NextResponse) return authz;
    const targetCompanyId = await userService.getCompanyOf(userId);
    if (!authz.canView(targetCompanyId)) {
      return NextResponse.json({ error: "Tidak punya akses ke PT ini" }, { status: 403 });
    }
  }

  const where: Record<string, unknown> = { userId };
  if (month && year) {
    const start = new Date(Number(year), Number(month) - 1, 1);
    const end = new Date(Number(year), Number(month), 1);
    where.date = { gte: start, lt: end };
  }

  const records = await prisma.attendance.findMany({
    where,
    orderBy: { date: "desc" },
  });

  return NextResponse.json(records);
}
