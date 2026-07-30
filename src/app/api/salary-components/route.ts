import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { salaryComponentService } from "@/backend/services/salary-component.service";
import { ok, fail } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { withValidation } from "@/backend/middleware/with-validation";
import { authorize } from "@/backend/helpers/authz";

export const salaryComponentSchema = z.object({
  /** null = komponen global, berlaku untuk semua PT. */
  companyId: z.string().min(1).nullish(),
  name: z.string().min(1).max(80),
  kind: z.enum(["ALLOWANCE", "DEDUCTION"]),
  defaultAmount: z.number().min(0).nullish(),
  note: z.string().max(300).nullish(),
  isActive: z.boolean().optional(),
});

type CreateBody = z.infer<typeof salaryComponentSchema>;

export async function GET() {
  try {
    const authz = await authorize("payroll.components", "view");
    if (authz instanceof NextResponse) return authz;

    return NextResponse.json(ok(await salaryComponentService.list(authz.companyIds)));
  } catch (e) {
    return handleError(e);
  }
}

export const POST = withValidation(salaryComponentSchema)(
  async (_req: NextRequest, ctx: { body: CreateBody }) => {
    try {
      const companyId = ctx.body.companyId ?? null;
      const authz = await authorize("payroll.components", "write", { companyId });
      if (authz instanceof NextResponse) return authz;

      // Komponen global menyentuh semua PT, jadi hanya boleh dibuat oleh
      // pemegang scope seluruh PT — `authorize` dengan companyId null tidak
      // menangkap ini karena null di sana berarti "tanpa PT", bukan "semua PT".
      if (companyId === null && authz.companyIds !== null) {
        return NextResponse.json(
          fail("FORBIDDEN", "Komponen global hanya bisa dibuat oleh pemegang akses seluruh PT"),
          { status: 403 }
        );
      }

      const component = await salaryComponentService.create({ ...ctx.body, companyId });
      return NextResponse.json(ok(component, "Komponen gaji berhasil ditambahkan"), {
        status: 201,
      });
    } catch (e) {
      return handleError(e);
    }
  }
);
