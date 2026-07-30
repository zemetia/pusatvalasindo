import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { salaryComponentService } from "@/backend/services/salary-component.service";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { withValidation } from "@/backend/middleware/with-validation";
import { authorize } from "@/backend/helpers/authz";
import { NotFoundError } from "@/backend/errors/app-error";

/**
 * Nilai komponen gaji tambahan milik satu karyawan.
 *
 * Gerbangnya `payroll.components`, bukan izin kelola pengguna: yang diubah di
 * sini adalah angka gaji, jadi wewenangnya ikut domain payroll. Scope PT
 * diambil dari cabang karyawan (single source of truth untuk PT).
 */

const putSchema = z.object({
  items: z
    .array(
      z.object({
        componentId: z.string().min(1),
        amount: z.number().min(0),
      })
    )
    .max(50),
});

type Params = { params: Promise<{ id: string }> };
type PutBody = z.infer<typeof putSchema>;

async function targetCompanyId(userId: string): Promise<string | null> {
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { branch: { select: { companyId: true } } },
  });
  if (!target) throw new NotFoundError("Karyawan tidak ditemukan");
  return target.branch?.companyId ?? null;
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const authz = await authorize("payroll.components", "view", {
      companyId: await targetCompanyId(id),
    });
    if (authz instanceof NextResponse) return authz;

    return NextResponse.json(ok(await salaryComponentService.listForUser(id)));
  } catch (e) {
    return handleError(e);
  }
}

export const PUT = withValidation(putSchema)(
  async (_req: NextRequest, ctx: Params & { body: PutBody }) => {
    try {
      const { id } = await ctx.params;
      const authz = await authorize("payroll.components", "write", {
        companyId: await targetCompanyId(id),
      });
      if (authz instanceof NextResponse) return authz;

      const saved = await salaryComponentService.replaceForUser(
        id,
        ctx.body.items,
        authz.companyIds
      );
      return NextResponse.json(ok(saved, "Komponen gaji karyawan berhasil disimpan"));
    } catch (e) {
      return handleError(e);
    }
  }
);
