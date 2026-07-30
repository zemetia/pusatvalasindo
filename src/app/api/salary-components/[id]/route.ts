import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { salaryComponentService } from "@/backend/services/salary-component.service";
import { ok, fail } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { withValidation } from "@/backend/middleware/with-validation";
import { authorize } from "@/backend/helpers/authz";
import { salaryComponentSchema } from "../route";

const updateSchema = salaryComponentSchema.partial();

type Params = { params: Promise<{ id: string }> };
type UpdateBody = ReturnType<typeof updateSchema.parse>;

/**
 * Gerbang tulis untuk satu komponen: PT PEMILIKNYA yang menentukan, bukan PT
 * di body — kalau tidak, admin satu PT bisa mengubah komponen PT lain dengan
 * mengirim companyId miliknya sendiri.
 */
async function authorizeWrite(id: string) {
  const component = await salaryComponentService.getById(id);
  const authz = await authorize("payroll.components", "write", {
    companyId: component.companyId,
  });
  if (authz instanceof NextResponse) return authz;
  if (component.companyId === null && authz.companyIds !== null) {
    return NextResponse.json(
      fail("FORBIDDEN", "Komponen global hanya bisa diubah oleh pemegang akses seluruh PT"),
      { status: 403 }
    );
  }
  return authz;
}

export const PUT = withValidation(updateSchema)(
  async (_req: NextRequest, ctx: Params & { body: UpdateBody }) => {
    try {
      const { id } = await ctx.params;
      const gate = await authorizeWrite(id);
      if (gate instanceof NextResponse) return gate;

      // Memindahkan komponen ke PT lain butuh izin di PT tujuan juga.
      if (ctx.body.companyId !== undefined) {
        const target = await authorize("payroll.components", "write", {
          companyId: ctx.body.companyId ?? null,
        });
        if (target instanceof NextResponse) return target;
        if (ctx.body.companyId === null && target.companyIds !== null) {
          return NextResponse.json(
            fail("FORBIDDEN", "Komponen global hanya bisa dibuat oleh pemegang akses seluruh PT"),
            { status: 403 }
          );
        }
      }

      const updated = await salaryComponentService.update(id, ctx.body);
      return NextResponse.json(ok(updated, "Komponen gaji berhasil diperbarui"));
    } catch (e) {
      return handleError(e);
    }
  }
);

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const gate = await authorizeWrite(id);
    if (gate instanceof NextResponse) return gate;

    await salaryComponentService.remove(id);
    return NextResponse.json(ok(null, "Komponen gaji berhasil dihapus"));
  } catch (e) {
    return handleError(e);
  }
}
