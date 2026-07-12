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

const createPocketSchema = z.object({
  companyId: z.string().min(1),
  name: z.string().min(1).max(100),
  code: z.string().max(20).optional(),
  sortOrder: z.number().int().optional(),
});

type CreateBody = z.infer<typeof createPocketSchema>;

// POST /api/stockist/kas/pockets — buat/kelola KasPocket baru (stockist.manage)
export const POST = withValidation(createPocketSchema)(
  async (_req: NextRequest, ctx: { body: CreateBody }) => {
    try {
      const caller = await requirePermission(PERMISSIONS.STOCKIST_MANAGE);
      if (caller instanceof NextResponse) return caller;

      assertCompanyAccess(caller, ctx.body.companyId);

      const pocket = await kasPocketRepository.create(ctx.body);
      return NextResponse.json(ok(pocket, "Kas pocket berhasil dibuat"), { status: 201 });
    } catch (e) {
      return handleError(e);
    }
  }
);
