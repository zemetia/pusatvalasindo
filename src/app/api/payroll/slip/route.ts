// Cek apakah gaji seorang karyawan untuk satu bulan SUDAH pernah dihitung dan
// tersimpan (lewat PayrollRun). Dipakai kalkulator cepat di halaman Payroll:
// begitu ada slip tersimpan, halaman langsung menampilkannya — tidak perlu
// pemakainya menekan "Hitung" lagi untuk sesuatu yang sudah punya jawaban.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { payrollRunService } from "@/backend/services/payroll-run.service";
import { canViewPayrollOf } from "@/backend/services/payroll.service";
import { serializeSlipDetail } from "@/app/api/payroll/runs/serialize";
import { ok, fail } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { requireAuth } from "@/backend/helpers/get-admin-caller";
import { getAuthzSubject } from "@/backend/helpers/authz";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const employeeId = url.searchParams.get("employeeId") ?? "";
    const month = Number(url.searchParams.get("month"));
    const year = Number(url.searchParams.get("year"));

    if (!employeeId || !Number.isInteger(month) || !Number.isInteger(year)) {
      return NextResponse.json(
        fail("VALIDATION_ERROR", "employeeId, month, dan year wajib diisi"),
        { status: 400 }
      );
    }

    const caller = await requireAuth();
    if (caller instanceof NextResponse) return caller;
    const subject = await getAuthzSubject();
    if (!subject) {
      return NextResponse.json(fail("UNAUTHORIZED", "Tidak terautentikasi"), { status: 401 });
    }

    const slip = await payrollRunService.findSlipDetailFor(employeeId, month, year);
    if (!slip) {
      // Belum pernah dihitung — bukan error, halaman akan menawarkan
      // kalkulator langsung.
      return NextResponse.json(ok({ slip: null }));
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
