import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { authorize } from "@/backend/helpers/authz";
import { withValidation } from "@/backend/middleware/with-validation";
import { stockistPocketRepository } from "@/backend/repositories/stockist-pocket.repository";
import { NotFoundError, ValidationError } from "@/backend/errors/app-error";

const updatePocketSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  code: z.string().max(20).nullable().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

type Params = { params: Promise<{ id: string }> };
type UpdateBody = z.infer<typeof updatePocketSchema>;

// PATCH /api/stockist/pockets/[id] — rename/reorder/nonaktifkan pocket (stockist.manage)
export const PATCH = withValidation(updatePocketSchema)(
  async (_req: NextRequest, ctx: Params & { body: UpdateBody }) => {
    try {
      const caller = await authorize("stockist.daily", "write");
      if (caller instanceof NextResponse) return caller;

      const { id } = await ctx.params;
      const existing = await stockistPocketRepository.findById(id);
      if (!existing) throw new NotFoundError("Pocket tidak ditemukan");
      caller.assertCompany(existing.companyId);
      if (existing.isDefault) {
        throw new ValidationError("Pocket Total tidak bisa diubah");
      }

      const pocket = await stockistPocketRepository.update(id, ctx.body);
      return NextResponse.json(ok(pocket, "Pocket berhasil diperbarui"));
    } catch (e) {
      return handleError(e);
    }
  }
);

// DELETE /api/stockist/pockets/[id] — soft delete pocket (stockist.manage). Pocket Total tidak bisa dihapus.
export async function DELETE(_req: NextRequest, ctx: Params) {
  try {
    const caller = await authorize("stockist.daily", "write");
    if (caller instanceof NextResponse) return caller;

    const { id } = await ctx.params;
    const existing = await stockistPocketRepository.findById(id);
    if (!existing || existing.deletedAt) throw new NotFoundError("Pocket tidak ditemukan");
    caller.assertCompany(existing.companyId);
    if (existing.isDefault) {
      throw new ValidationError("Pocket Total tidak bisa dihapus");
    }

    await stockistPocketRepository.softDelete(id);
    return NextResponse.json(ok(null, "Pocket berhasil dihapus"));
  } catch (e) {
    return handleError(e);
  }
}
