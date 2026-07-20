import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { payrollService, assertPayrollAccess } from "@/backend/services/payroll.service";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { withValidation } from "@/backend/middleware/with-validation";
import { getAdminCaller } from "@/backend/helpers/get-admin-caller";
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
      const caller = await getAdminCaller();
      if (caller instanceof NextResponse) return caller;

      const { employeeId, month, year } = ctx.body;

      const target = await prisma.user.findUnique({
        where: { id: employeeId },
        select: { companyId: true },
      });
      assertPayrollAccess(caller, employeeId, target?.companyId ?? null);

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
