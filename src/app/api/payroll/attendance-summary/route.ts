// Rekap kehadiran satu bulan untuk seluruh karyawan aktif satu PT.
//
// Dipakai di halaman Hitung Gaji supaya HR bisa memeriksa kehadiran periode
// tersebut SEBELUM menjalankan Hitung — bukan menghitung ulang absensi per
// slip satu-satu. Wewenangnya sama dengan panel run (`payroll.manage`),
// bukan `attendance.all`, supaya siapa pun yang boleh mengelola gaji PT ini
// juga bisa melihat rekapnya tanpa izin tambahan.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import prisma from "@/lib/prisma";
import { AttendanceStatus } from "@src/generated/prisma";
import { ok, fail } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { requireAuth } from "@/backend/helpers/get-admin-caller";
import { getAuthzSubject } from "@/backend/helpers/authz";
import { allowsCompany } from "@/lib/authz/resolve";

export type AttendanceSummaryRow = {
  userId: string;
  name: string;
  branchName: string;
  roleName: string;
  counts: Record<string, number>;
  totalLogged: number;
};

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const companyId = url.searchParams.get("companyId") ?? "";
    const month = Number(url.searchParams.get("month"));
    const year = Number(url.searchParams.get("year"));

    if (!companyId || !Number.isInteger(month) || !Number.isInteger(year)) {
      return NextResponse.json(
        fail("VALIDATION_ERROR", "companyId, month, dan year wajib diisi"),
        { status: 400 }
      );
    }

    const caller = await requireAuth();
    if (caller instanceof NextResponse) return caller;
    const subject = await getAuthzSubject();
    if (!subject) {
      return NextResponse.json(fail("UNAUTHORIZED", "Tidak terautentikasi"), { status: 401 });
    }
    if (!allowsCompany(subject, "payroll.manage", "view", companyId)) {
      return NextResponse.json(fail("FORBIDDEN", "Tidak punya akses ke gaji PT ini"), {
        status: 403,
      });
    }

    const employees = await prisma.user.findMany({
      where: { isActive: true, customRoleId: { not: null }, branch: { companyId } },
      select: {
        id: true,
        name: true,
        branch: { select: { name: true } },
        customRole: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    });

    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);

    const grouped = await prisma.attendance.groupBy({
      by: ["userId", "status"],
      where: { userId: { in: employees.map((e) => e.id) }, date: { gte: start, lt: end } },
      _count: { _all: true },
    });

    const countsByUser = new Map<string, Record<string, number>>();
    for (const g of grouped) {
      const bucket = countsByUser.get(g.userId) ?? {};
      bucket[g.status] = g._count._all;
      countsByUser.set(g.userId, bucket);
    }

    const rows: AttendanceSummaryRow[] = employees.map((e) => {
      const counts = countsByUser.get(e.id) ?? {};
      return {
        userId: e.id,
        name: e.name,
        branchName: e.branch?.name ?? "—",
        roleName: e.customRole?.name ?? "Karyawan",
        counts,
        totalLogged: Object.values(counts).reduce((s, n) => s + n, 0),
      };
    });

    return NextResponse.json(
      ok({ rows, statuses: Object.values(AttendanceStatus) as string[] })
    );
  } catch (e) {
    return handleError(e);
  }
}
