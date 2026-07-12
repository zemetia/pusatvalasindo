import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { requirePermission } from "@/backend/helpers/get-admin-caller";
import { withValidation } from "@/backend/middleware/with-validation";
import { PERMISSIONS } from "@/lib/permissions";
import { assertCompanyAccess } from "@/backend/services/stockist.service";
import { kasPocketRepository } from "@/backend/repositories/kas-pocket.repository";
import { NotFoundError } from "@/backend/errors/app-error";

const updatePocketSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  code: z.string().max(20).nullable().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

type Params = { params: Promise<{ id: string }> };
type UpdateBody = z.infer<typeof updatePocketSchema>;

// PATCH /api/stockist/kas/pockets/[id] — rename/reorder/nonaktifkan kas pocket (stockist.manage)
export const PATCH = withValidation(updatePocketSchema)(
  async (_req: NextRequest, ctx: Params & { body: UpdateBody }) => {
    try {
      const caller = await requirePermission(PERMISSIONS.STOCKIST_MANAGE);
      if (caller instanceof NextResponse) return caller;

      const { id } = await ctx.params;
      const existing = await kasPocketRepository.findById(id);
      if (!existing) throw new NotFoundError("Kas pocket tidak ditemukan");
      assertCompanyAccess(caller, existing.companyId);

      const pocket = await kasPocketRepository.update(id, ctx.body);
      return NextResponse.json(ok(pocket, "Kas pocket berhasil diperbarui"));
    } catch (e) {
      return handleError(e);
    }
  }
);
