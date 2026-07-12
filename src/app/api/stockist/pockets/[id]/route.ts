import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { requirePermission } from "@/backend/helpers/get-admin-caller";
import { withValidation } from "@/backend/middleware/with-validation";
import { PERMISSIONS } from "@/lib/permissions";
import { assertCompanyAccess } from "@/backend/services/stockist.service";
import { stockistPocketRepository } from "@/backend/repositories/stockist-pocket.repository";
import { NotFoundError } from "@/backend/errors/app-error";

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
      const caller = await requirePermission(PERMISSIONS.STOCKIST_MANAGE);
      if (caller instanceof NextResponse) return caller;

      const { id } = await ctx.params;
      const existing = await stockistPocketRepository.findById(id);
      if (!existing) throw new NotFoundError("Pocket tidak ditemukan");
      assertCompanyAccess(caller, existing.companyId);

      const pocket = await stockistPocketRepository.update(id, ctx.body);
      return NextResponse.json(ok(pocket, "Pocket berhasil diperbarui"));
    } catch (e) {
      return handleError(e);
    }
  }
);
