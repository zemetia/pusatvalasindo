// Hapus satu entri penyesuaian manual dari sebuah slip gaji.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import prisma from "@/lib/prisma";
import { payrollRunService } from "@/backend/services/payroll-run.service";
import { ok, fail } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { requireAuth } from "@/backend/helpers/get-admin-caller";
import { getAuthzSubject } from "@/backend/helpers/authz";
import { allowsCompany } from "@/lib/authz/resolve";
import { serializeSlipDetail } from "@/app/api/payroll/runs/serialize";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ runId: string; slipId: string; entryId: string }> }
) {
  try {
    const { runId, slipId, entryId } = await params;

    const caller = await requireAuth();
    if (caller instanceof NextResponse) return caller;
    const subject = await getAuthzSubject();
    if (!subject) {
      return NextResponse.json(fail("UNAUTHORIZED", "Tidak terautentikasi"), { status: 401 });
    }

    const entry = await prisma.payrollSlipEntry.findUnique({
      where: { id: entryId },
      select: { slipId: true, slip: { select: { runId: true, run: { select: { companyId: true } } } } },
    });
    if (!entry || entry.slipId !== slipId || entry.slip.runId !== runId) {
      return NextResponse.json(fail("NOT_FOUND", "Entri tidak ditemukan"), { status: 404 });
    }
    if (!allowsCompany(subject, "payroll.manage", "write", entry.slip.run.companyId)) {
      return NextResponse.json(fail("FORBIDDEN", "Tidak punya akses ke gaji PT ini"), {
        status: 403,
      });
    }

    await payrollRunService.removeManualEntry(entryId);

    const detail = await payrollRunService.getSlipDetail(slipId);

    return NextResponse.json(
      ok({ slip: detail ? serializeSlipDetail(detail) : null }, "Penyesuaian manual berhasil dihapus")
    );
  } catch (e) {
    return handleError(e);
  }
}
