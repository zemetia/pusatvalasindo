// Detail satu slip gaji — dasar halaman detail gaji per orang per bulan.
//
// Dua jalur akses, sama seperti /api/payroll/calculate:
//   • `payroll.manage` di PT slip ini — HR/admin melihat gaji orang lain.
//   • `payroll.self` — karyawan melihat slipnya sendiri.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { payrollRunService } from "@/backend/services/payroll-run.service";
import { canViewPayrollOf } from "@/backend/services/payroll.service";
import { ok, fail } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { requireAuth } from "@/backend/helpers/get-admin-caller";
import { getAuthzSubject } from "@/backend/helpers/authz";
import { serializeSlipDetail } from "@/app/api/payroll/runs/serialize";

export async function GET(
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

    const slip = await payrollRunService.getSlipDetail(slipId);
    if (!slip || slip.runId !== runId) {
      return NextResponse.json(fail("NOT_FOUND", "Slip gaji tidak ditemukan"), { status: 404 });
    }
    if (!canViewPayrollOf(subject, caller.id, slip.userId, slip.run.companyId)) {
      return NextResponse.json(fail("FORBIDDEN", "Tidak punya akses ke data gaji ini"), {
        status: 403,
      });
    }

    return NextResponse.json(ok({ slip: serializeSlipDetail(slip) }));
  } catch (e) {
    return handleError(e);
  }
}
