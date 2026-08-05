// Menandai satu slip (satu karyawan) di dalam sebuah run sudah dibayar,
// tanpa menunggu rekan sejawatnya di run yang sama.
//
// Berbeda dari /api/payroll/runs/[runId]/pay yang membayar seluruh run
// sekaligus — ini untuk kasus HR membayar karyawan satu-satu, mis. karena
// transfer bank dilakukan bertahap.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import prisma from "@/lib/prisma";
import { payrollRunService } from "@/backend/services/payroll-run.service";
import { ok, fail } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { requireAuth } from "@/backend/helpers/get-admin-caller";
import { getAuthzSubject } from "@/backend/helpers/authz";
import { allowsCompany } from "@/lib/authz/resolve";

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

    // PT-nya diambil dari slip → run, bukan dari input.
    const slip = await prisma.payrollSlip.findUnique({
      where: { id: slipId },
      select: { runId: true, run: { select: { companyId: true } } },
    });
    if (!slip || slip.runId !== runId) {
      return NextResponse.json(fail("NOT_FOUND", "Slip gaji tidak ditemukan"), { status: 404 });
    }
    if (!allowsCompany(subject, "payroll.manage", "write", slip.run.companyId)) {
      return NextResponse.json(fail("FORBIDDEN", "Tidak punya akses ke gaji PT ini"), {
        status: 403,
      });
    }

    const updated = await payrollRunService.markSlipPaid(slipId, caller.id);

    return NextResponse.json(
      ok(
        { id: updated.id, paidAt: updated.paidAt?.toISOString() ?? null },
        "Gaji karyawan ditandai sudah dibayar"
      )
    );
  } catch (e) {
    return handleError(e);
  }
}
