import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { rolePermissionService } from "@/backend/services/role-permission.service";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { withValidation } from "@/backend/middleware/with-validation";
import { authorize, grantableCompanyIds } from "@/backend/helpers/authz";

const scopeMode = z.enum(["NONE", "OWN", "SELECTED", "ALL"]);

const grantSchema = z.object({
  resource: z.string().min(1),
  viewScope: scopeMode,
  viewCompanyIds: z.array(z.string()).default([]),
  writeScope: scopeMode,
  writeCompanyIds: z.array(z.string()).default([]),
});

const putSchema = z.object({
  grants: z.array(grantSchema),
});

type PutBody = z.infer<typeof putSchema>;

// Resource `roles` bersifat global: pemegangnya mengelola jabatan seluruh PT,
// jadi tidak ada lagi gerbang "hanya jabatan PT saya" di sini. Yang tetap
// dipertahankan adalah batas ESKALASI di bawah (`grantable`): mengelola izin
// tidak sama dengan boleh memberikan wewenang lintas PT.

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authz = await authorize("roles", "view");
  if (authz instanceof NextResponse) return authz;

  try {
    const { id } = await params;
    const grants = await rolePermissionService.getByRole(id);
    return NextResponse.json(ok(grants));
  } catch (e) {
    return handleError(e);
  }
}

export const PUT = withValidation(putSchema)(
  async (_req: NextRequest, ctx: { body: PutBody; params: Promise<{ id: string }> }) => {
    const authz = await authorize("roles", "write");
    if (authz instanceof NextResponse) return authz;

    try {
      const { id } = await ctx.params;

      // PT yang boleh diberikan oleh si pengatur. Role global tak terbatas;
      // pengelola jabatan yang didelegasikan hanya boleh memberi akses ke
      // PT-nya sendiri, sehingga tidak bisa mengeskalasi jabatan mana pun ke
      // PT lain — termasuk jabatannya sendiri. Batas yang sama dipakai saat
      // membuat/mengubah jabatan (lihat roleService).
      const grantable = grantableCompanyIds(authz);

      const grants = await rolePermissionService.replaceForRole(id, ctx.body.grants, grantable);
      return NextResponse.json(ok(grants, "Izin role diperbarui"));
    } catch (e) {
      return handleError(e);
    }
  }
);

/** Daftar PT yang bisa dipilih di matriks izin (mode SELECTED). */
export async function OPTIONS() {
  const authz = await authorize("roles", "view");
  if (authz instanceof NextResponse) return authz;

  // Daftar PT yang bisa dipilih mengikuti batas `grantable` di atas, bukan
  // scope baca — supaya UI tidak menawarkan PT yang pasti ditolak saat disimpan.
  const grantable = grantableCompanyIds(authz);
  const companies = await prisma.company.findMany({
    where: {
      isActive: true,
      ...(grantable === null ? {} : { id: { in: grantable } }),
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true },
  });
  return NextResponse.json(ok(companies));
}
