import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { payrollService, assertPayrollAccess } from "@/backend/services/payroll.service";
import { ok, fail } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { withValidation } from "@/backend/middleware/with-validation";
import { requireAuth } from "@/backend/helpers/get-admin-caller";
import { getAuthzSubject } from "@/backend/helpers/authz";
import prisma from "@/lib/prisma";

const calculateSchema = z.object({
  employeeId: z.string().min(1),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
});

type CalculateBody = z.infer<typeof calculateSchema>;

export const POST = withValidation(calculateSchema)(
  async (_req: NextRequest, ctx: { body: CalculateBody }) => {
    try {
      // Gerbangnya bukan lagi "role admin", melainkan `payroll.manage` di PT
      // karyawan yang bersangkutan — atau karyawan itu dirinya sendiri.
      const caller = await requireAuth();
      if (caller instanceof NextResponse) return caller;
      const subject = await getAuthzSubject();
      if (!subject) {
        return NextResponse.json(fail("UNAUTHORIZED", "Tidak terautentikasi"), { status: 401 });
      }

      const { employeeId, month, year } = ctx.body;

      const target = await prisma.user.findUnique({
        where: { id: employeeId },
        select: { branch: { select: { companyId: true } } },
      });
      assertPayrollAccess(subject, caller.id, employeeId, target?.branch?.companyId ?? null);

      const result = await payrollService.calculateMonthlyPayroll(
        employeeId,
        month,
        year
      );
      return NextResponse.json(
        ok(result, "Gaji bulan ini berhasil dihitung"),
        { status: 201 }
      );
    } catch (e) {
      return handleError(e);
    }
  }
);
