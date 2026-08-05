// GET  — cek apakah gaji seorang karyawan untuk satu bulan SUDAH pernah
//        dihitung dan tersimpan (lewat PayrollRun). Dipakai kalkulator cepat
//        di halaman Payroll: begitu ada slip tersimpan, halaman langsung
//        menampilkannya — tidak perlu pemakainya menekan "Hitung" lagi untuk
//        sesuatu yang sudah punya jawaban.
// POST — hitung & simpan gaji SATU karyawan, tanpa menunggu seluruh PT-nya
//        di-generate. Inilah yang membuat kalkulator cepat menghasilkan slip
//        sungguhan (dengan kehadiran & penyesuaian manual), bukan cuma
//        pratinjau. `payroll.manage` write saja — karyawan yang cuma melihat
//        gajinya sendiri (`payroll.self`) tetap memakai /api/payroll/calculate
//        yang murni pratinjau, tidak tersimpan.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import prisma from "@/lib/prisma";
import { payrollRunService } from "@/backend/services/payroll-run.service";
import { canViewPayrollOf } from "@/backend/services/payroll.service";
import { serializeSlipDetail } from "@/app/api/payroll/runs/serialize";
import { ok, fail } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { withValidation } from "@/backend/middleware/with-validation";
import { requireAuth } from "@/backend/helpers/get-admin-caller";
import { getAuthzSubject } from "@/backend/helpers/authz";
import { allowsCompany } from "@/lib/authz/resolve";

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

const generateSlipSchema = z.object({
  employeeId: z.string().min(1),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
});

type GenerateSlipBody = z.infer<typeof generateSlipSchema>;

export const POST = withValidation(generateSlipSchema)(
  async (_req: NextRequest, ctx: { body: GenerateSlipBody }) => {
    try {
      const { employeeId, month, year } = ctx.body;

      const caller = await requireAuth();
      if (caller instanceof NextResponse) return caller;
      const subject = await getAuthzSubject();
      if (!subject) {
        return NextResponse.json(fail("UNAUTHORIZED", "Tidak terautentikasi"), { status: 401 });
      }

      const target = await prisma.user.findUnique({
        where: { id: employeeId },
        select: { branch: { select: { companyId: true } } },
      });
      const companyId = target?.branch?.companyId ?? null;
      if (!allowsCompany(subject, "payroll.manage", "write", companyId)) {
        return NextResponse.json(fail("FORBIDDEN", "Tidak punya akses ke gaji PT ini"), {
          status: 403,
        });
      }

      const slipId = await payrollRunService.generateOrUpdateSlipFor({
        userId: employeeId,
        month,
        year,
        generatedById: caller.id,
      });

      const slip = await payrollRunService.getSlipDetail(slipId);

      return NextResponse.json(
        ok({ slip: slip ? serializeSlipDetail(slip) : null }, "Gaji berhasil dihitung dan disimpan"),
        { status: 201 }
      );
    } catch (e) {
      return handleError(e);
    }
  }
);
