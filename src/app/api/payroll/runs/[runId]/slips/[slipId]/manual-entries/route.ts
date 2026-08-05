// Penyesuaian manual pada satu slip gaji — bonus, denda, atau potongan/utang
// tambahan di luar apa pun yang dihasilkan rule reward & denda, dengan alasan
// wajib tertulis. Hanya HR/admin (`payroll.manage` write di PT slip ini) yang
// boleh menambahkannya — bukan jalur `payroll.self`, karena ini mengubah gaji.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import prisma from "@/lib/prisma";
import { payrollRunService } from "@/backend/services/payroll-run.service";
import { ok, fail } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { withValidation } from "@/backend/middleware/with-validation";
import { requireAuth } from "@/backend/helpers/get-admin-caller";
import { getAuthzSubject } from "@/backend/helpers/authz";
import { allowsCompany } from "@/lib/authz/resolve";
import { serializeSlipDetail } from "@/app/api/payroll/runs/serialize";

const manualEntrySchema = z.object({
  type: z.enum(["BONUS", "DENDA", "POTONGAN"]),
  label: z.string().min(1, "Alasan wajib diisi").max(200),
  amount: z.number().positive("Nominal harus lebih dari 0"),
});

type ManualEntryBody = z.infer<typeof manualEntrySchema>;

export const POST = withValidation(manualEntrySchema)(
  async (
    _req: NextRequest,
    ctx: { body: ManualEntryBody; params: Promise<{ runId: string; slipId: string }> }
  ) => {
    try {
      const { runId, slipId } = await ctx.params;

      const caller = await requireAuth();
      if (caller instanceof NextResponse) return caller;
      const subject = await getAuthzSubject();
      if (!subject) {
        return NextResponse.json(fail("UNAUTHORIZED", "Tidak terautentikasi"), { status: 401 });
      }

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

      await payrollRunService.addManualEntry({ slipId, ...ctx.body });

      const detail = await payrollRunService.getSlipDetail(slipId);

      return NextResponse.json(
        ok(
          { slip: detail ? serializeSlipDetail(detail) : null },
          "Penyesuaian manual berhasil ditambahkan"
        ),
        { status: 201 }
      );
    } catch (e) {
      return handleError(e);
    }
  }
);
