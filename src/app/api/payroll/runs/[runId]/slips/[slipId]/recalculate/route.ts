// Hitung ulang satu slip di dalam run yang sedang berjalan (belum dibayar),
// tanpa membuat run/attempt baru dan tanpa menyentuh slip karyawan lain.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import prisma from "@/lib/prisma";
import { payrollRunService } from "@/backend/services/payroll-run.service";
import { ok, fail } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { requireAuth } from "@/backend/helpers/get-admin-caller";
import { getAuthzSubject } from "@/backend/helpers/authz";
import { allowsCompany } from "@/lib/authz/resolve";
import { serializeRun } from "@/app/api/payroll/runs/serialize";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ runId: string; slipId: string }> }
) {
  try {
    const { runId, slipId } = await params;

    const caller = await requireAuth();
    if (caller instanceof NextResponse) return caller;
    const subject = await getAuthzSubject();
    if (!subject) {
      return NextResponse.json(fail("UNAUTHORIZED", "Tidak terautentikasi"), { status: 401 });
    }

    const slip = await prisma.payrollSlip.findUnique({
      where: { id: slipId },
      select: {
        runId: true,
        run: { select: { companyId: true, periodMonth: true, periodYear: true } },
      },
    });
    if (!slip || slip.runId !== runId) {
      return NextResponse.json(fail("NOT_FOUND", "Slip gaji tidak ditemukan"), { status: 404 });
    }
    if (!allowsCompany(subject, "payroll.manage", "write", slip.run.companyId)) {
      return NextResponse.json(fail("FORBIDDEN", "Tidak punya akses ke gaji PT ini"), {
        status: 403,
      });
    }

    await payrollRunService.recalculateSlip(slipId);

    // Baca ulang seluruh run — bentuk yang dikembalikan ke halaman selalu
    // satu, sama seperti generate-run di /api/payroll/runs.
    const run = await payrollRunService.getRun(
      slip.run.companyId,
      slip.run.periodMonth,
      slip.run.periodYear
    );

    return NextResponse.json(
      ok({ run: run ? serializeRun(run) : null }, "Slip gaji berhasil dihitung ulang")
    );
  } catch (e) {
    return handleError(e);
  }
}
