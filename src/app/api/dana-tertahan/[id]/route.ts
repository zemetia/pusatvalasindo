import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { authorize } from "@/backend/helpers/authz";
import { withValidation } from "@/backend/middleware/with-validation";
import { assertHeldFundEditableDate } from "@/backend/helpers/held-fund-guard";
import { heldFundRepository } from "@/backend/repositories/held-fund.repository";
import { toHeldFundRow } from "@/backend/services/held-fund.service";
import { NotFoundError } from "@/backend/errors/app-error";

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  kind: z.enum(["CREDIT", "DEBIT"]).optional(),
  amount: z.number().optional(),
  note: z.string().max(500).nullable().optional(),
});

type Params = { params: Promise<{ id: string }> };
type UpdateBody = z.infer<typeof updateSchema>;

// PATCH /api/dana-tertahan/[id] — ubah nama / jumlah / catatan satu baris.
// Dipanggil saat input kehilangan fokus, jadi bodynya bisa berisi satu field saja.
export const PATCH = withValidation(updateSchema)(
  async (_req: NextRequest, ctx: Params & { body: UpdateBody }) => {
    try {
      // PT-nya baru diketahui setelah barisnya dibaca, jadi gerbang PT ditegakkan
      // lewat `assertCompany` di bawah — bukan lewat opsi companyId di sini.
      const caller = await authorize("finance.receivable", "write");
      if (caller instanceof NextResponse) return caller;

      const { id } = await ctx.params;
      const existing = await heldFundRepository.findById(id);
      if (!existing) throw new NotFoundError("Dana tertahan tidak ditemukan");
      caller.assertCompany(existing.companyId);
      assertHeldFundEditableDate(caller, existing.companyId, existing.date);

      const updated = await heldFundRepository.update(id, {
        ...(ctx.body.name !== undefined ? { name: ctx.body.name.trim() } : {}),
        ...(ctx.body.kind !== undefined ? { kind: ctx.body.kind } : {}),
        ...(ctx.body.amount !== undefined ? { amount: ctx.body.amount } : {}),
        ...(ctx.body.note !== undefined ? { note: ctx.body.note } : {}),
      });

      return NextResponse.json(ok(toHeldFundRow(updated), "Tersimpan"));
    } catch (e) {
      return handleError(e);
    }
  }
);

// DELETE /api/dana-tertahan/[id] — untuk baris yang salah catat.
// Pelunasan TIDAK memakai ini: lunas menandai, tidak menghapus (lihat ./lunas).
export async function DELETE(_req: NextRequest, ctx: Params) {
  try {
    const caller = await authorize("finance.receivable", "write");
    if (caller instanceof NextResponse) return caller;

    const { id } = await ctx.params;
    const existing = await heldFundRepository.findById(id);
    if (!existing) throw new NotFoundError("Dana tertahan tidak ditemukan");
    caller.assertCompany(existing.companyId);
    assertHeldFundEditableDate(caller, existing.companyId, existing.date);

    await heldFundRepository.delete(id);
    return NextResponse.json(ok({ id }, "Dana tertahan dihapus"));
  } catch (e) {
    return handleError(e);
  }
}
