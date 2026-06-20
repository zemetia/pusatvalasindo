import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { AttendanceStatus } from "@src/generated/prisma";

// Work start time: 17:40 (5:40 PM). Check-in after this = LATE.
const WORK_START_HOUR = 17;
const WORK_START_MINUTE = 40;

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

function resolveStatus(checkInTime: Date): AttendanceStatus {
  const h = checkInTime.getHours();
  const m = checkInTime.getMinutes();
  const isLate =
    h > WORK_START_HOUR || (h === WORK_START_HOUR && m > WORK_START_MINUTE);
  return isLate ? AttendanceStatus.LATE : AttendanceStatus.PRESENT;
}

export async function POST(req: NextRequest) {
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

  const checkInTime = new Date(checkIn);
  const status = resolveStatus(checkInTime);

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
      isLocationSuspect,
      status,
      notes,
    },
  });

  return NextResponse.json(attendance, { status: 201 });
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
