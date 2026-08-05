// Menandai satu run payroll sudah dibayar.
//
// Setelah ini isi run tidak boleh berubah lagi: generate ulang periode yang
// sama membuat run baru dan tidak menyentuh run yang sudah dibayar.

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
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params;

    const caller = await requireAuth();
    if (caller instanceof NextResponse) return caller;
    const subject = await getAuthzSubject();
    if (!subject) {
      return NextResponse.json(fail("UNAUTHORIZED", "Tidak terautentikasi"), { status: 401 });
    }

    // PT-nya diambil dari run itu sendiri, bukan dari pemanggil — kalau
    // diambil dari input, siapa pun yang punya `payroll.manage` di satu PT bisa
    // membayarkan run milik PT lain.
    const run = await prisma.payrollRun.findUnique({
      where: { id: runId },
      select: { companyId: true },
    });
    if (!run) {
      return NextResponse.json(fail("NOT_FOUND", "Run payroll tidak ditemukan"), { status: 404 });
    }
    if (!allowsCompany(subject, "payroll.manage", "write", run.companyId)) {
      return NextResponse.json(fail("FORBIDDEN", "Tidak punya akses ke gaji PT ini"), {
        status: 403,
      });
    }

    const updated = await payrollRunService.markPaid(runId, caller.id);

    return NextResponse.json(
      ok(
        {
          id: updated.id,
          status: updated.status,
          paidAt: updated.paidAt?.toISOString() ?? null,
        },
        "Gaji ditandai sudah dibayar"
      )
    );
  } catch (e) {
    return handleError(e);
  }
}
