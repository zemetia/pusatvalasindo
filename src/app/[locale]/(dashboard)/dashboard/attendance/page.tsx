import type { Metadata } from "next";
import { AttendanceClient } from "./attendance-client";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { PageShell, PageHeader, ErrorPanel } from "@/components/admin/page-shell";
import { requireResource } from "@/backend/helpers/authz";
import { IconFingerprint } from "@tabler/icons-react";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Dashboard.Attendance" });
  return {
    title: `${t("title")} - Pusat Valas Indo`,
    description: t("description"),
  };
}

export default async function AttendancePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // Halamannya ikut gerbang yang sama dengan menunya di sidebar. Sebelumnya
  // hanya sesi yang diperiksa, jadi mencabut Presensi cuma menyembunyikan menu
  // sementara URL-nya tetap bisa dibuka langsung.
  await requireResource("attendance.self", "view", locale);
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect(`/${locale}/login`);
  }

  const t = await getTranslations("Dashboard.Attendance");

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  let initialRecords;
  // Rotasi antar cabang: karyawan bisa absen di cabang PT mana pun, bukan
  // cuma cabang di profilnya — jadi UI perlu tahu geofence SEMUA cabang aktif
  // milik PT-nya, sama seperti pengecekan otoritatif di POST /api/attendance.
  let branchGeofences: { id: string; latitude: number; longitude: number; radiusM: number; name: string }[] = [];

  try {
    const [records, userWithBranch] = await Promise.all([
      prisma.attendance.findMany({
        where: {
          userId: session.user.id,
          date: { gte: startOfMonth, lte: endOfMonth },
        },
        include: { checkInBranch: { select: { name: true } } },
        orderBy: { date: "desc" },
      }),
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          branch: { select: { companyId: true } },
        },
      }),
    ]);

    initialRecords = records;

    const companyId = userWithBranch?.branch?.companyId ?? null;
    if (companyId) {
      const branches = await prisma.branch.findMany({
        where: {
          companyId,
          isActive: true,
          latitude: { not: null },
          longitude: { not: null },
        },
        select: { id: true, latitude: true, longitude: true, attendanceRadiusM: true, name: true },
      });
      branchGeofences = branches.map((b) => ({
        id: b.id,
        latitude: b.latitude!,
        longitude: b.longitude!,
        radiusM: b.attendanceRadiusM ?? 20,
        name: b.name,
      }));
    }
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    return (
      <ErrorPanel source="attendance/page" message={msg} />
    );
  }

  return (
    <PageShell>
      <PageHeader
        title={t("title")}
        description={t("description")}
        icon={<IconFingerprint className="size-5" />}
      />
      <AttendanceClient
        userId={session.user.id}
        initialRecords={JSON.parse(JSON.stringify(initialRecords))}
        branchGeofences={branchGeofences}
      />
    </PageShell>
  );
}
