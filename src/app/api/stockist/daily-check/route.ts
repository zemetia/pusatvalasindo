import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { requirePermission } from "@/backend/helpers/get-admin-caller";
import { withValidation } from "@/backend/middleware/with-validation";
import { PERMISSIONS } from "@/lib/permissions";
import { assertCompanyAccess, stockistService } from "@/backend/services/stockist.service";
import { stockistPocketRepository } from "@/backend/repositories/stockist-pocket.repository";
import type { StockistCheckStatus } from "@src/generated/prisma/client";
import { NotFoundError } from "@/backend/errors/app-error";

const markCheckSchema = z.object({
  pocketId: z.string().min(1),
  companyStockItemId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["BENAR", "BEDA"]),
  note: z.string().max(500).optional(),
  correctedQuantity: z.number().optional(),
});

type Body = z.infer<typeof markCheckSchema>;

// PATCH /api/stockist/daily-check — aksi klik "Tandai Benar"/"Tandai Beda" (stockist.manage)
export const PATCH = withValidation(markCheckSchema)(
  async (_req: NextRequest, ctx: { body: Body }) => {
    try {
      const caller = await requirePermission(PERMISSIONS.STOCKIST_MANAGE);
      if (caller instanceof NextResponse) return caller;

      const pocket = await stockistPocketRepository.findById(ctx.body.pocketId);
      if (!pocket) throw new NotFoundError("Pocket tidak ditemukan");
      assertCompanyAccess(caller, pocket.companyId);

      const result = await stockistService.markDailyCheck({
        pocketId: ctx.body.pocketId,
        companyStockItemId: ctx.body.companyStockItemId,
        date: new Date(ctx.body.date),
        status: ctx.body.status as StockistCheckStatus,
        note: ctx.body.note,
        correctedQuantity: ctx.body.correctedQuantity,
        reviewedBy: caller.id,
      });

      return NextResponse.json(
        ok(
          {
            ...result.check,
            correctionRequestId: result.correctionRequest?.id ?? null,
          },
          result.correctionRequest
            ? "Ditandai Beda — koreksi menunggu persetujuan Owner/Super Admin"
            : "Status berhasil disimpan"
        )
      );
    } catch (e) {
      return handleError(e);
    }
  }
);
