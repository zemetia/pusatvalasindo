import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { authorize } from "@/backend/helpers/authz";
import { withValidation } from "@/backend/middleware/with-validation";
import { heldFundRepository } from "@/backend/repositories/held-fund.repository";
import { NotFoundError } from "@/backend/errors/app-error";

const settleSchema = z.object({ settled: z.boolean() });

type Params = { params: Promise<{ id: string }> };
type SettleBody = z.infer<typeof settleSchema>;

/**
 * PATCH /api/dana-tertahan/[id]/lunas — body { settled }
 *
 * Endpoint terpisah dari PATCH isi karena gerbangnya berbeda:
 *
 * • Resource-nya `finance.receivable.settle`, bukan `finance.receivable`. Yang
 *   mencatat hutang belum tentu berhak menyatakan uangnya sudah masuk — kalau
 *   satu sakelar, pencatat piutang bisa menghapusnya dari laporan sendiri.
 * • Tanpa gerbang `daily.backdate`. Melunasi hutang bertanggal lampau adalah
 *   alur normalnya (uangnya baru masuk hari ini), bukan pembetulan angka lampau.
 */
export const PATCH = withValidation(settleSchema)(
  async (_req: NextRequest, ctx: Params & { body: SettleBody }) => {
    try {
      // Tanpa opsi companyId: PT-nya baru diketahui setelah barisnya dibaca,
      // jadi gerbang PT-nya `assertCompany` di bawah.
      const caller = await authorize("finance.receivable.settle", "write");
      if (caller instanceof NextResponse) return caller;

      const { id } = await ctx.params;
      const existing = await heldFundRepository.findById(id);
      if (!existing) throw new NotFoundError("Dana tertahan tidak ditemukan");
      caller.assertCompany(existing.companyId);

      const updated = await heldFundRepository.setSettled(id, ctx.body.settled, caller.userId);

      return NextResponse.json(
        ok(
          {
            id: updated.id,
            name: updated.name,
            amount: updated.amount.toString(),
            note: updated.note,
            settledAt: updated.settledAt?.toISOString() ?? null,
          },
          ctx.body.settled ? "Ditandai lunas" : "Ditandai belum lunas"
        )
      );
    } catch (e) {
      return handleError(e);
    }
  }
);
