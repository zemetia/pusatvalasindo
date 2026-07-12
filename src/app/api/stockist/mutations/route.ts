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
import type { StockistMutationType } from "@src/generated/prisma/client";
import { NotFoundError, ValidationError } from "@/backend/errors/app-error";

const mutationSchema = z.object({
  pocketId: z.string().min(1),
  companyStockItemId: z.string().min(1),
  type: z.enum(["OPENING", "TOP_UP", "WITHDRAWAL", "TRANSFER_IN", "TRANSFER_OUT", "ADJUSTMENT"]),
  quantity: z.number(),
  note: z.string().max(500).optional(),
  // Only required when type is TRANSFER_OUT — moves the same quantity into another pocket atomically.
  toPocketId: z.string().optional(),
});

type Body = z.infer<typeof mutationSchema>;

// POST /api/stockist/mutations — top-up / withdrawal / transfer manual (stockist.manage)
export const POST = withValidation(mutationSchema)(
  async (_req: NextRequest, ctx: { body: Body }) => {
    try {
      const caller = await requirePermission(PERMISSIONS.STOCKIST_MANAGE);
      if (caller instanceof NextResponse) return caller;

      const pocket = await stockistPocketRepository.findById(ctx.body.pocketId);
      if (!pocket) throw new NotFoundError("Pocket tidak ditemukan");
      assertCompanyAccess(caller, pocket.companyId);

      if (ctx.body.type === "TRANSFER_OUT") {
        if (!ctx.body.toPocketId) {
          throw new ValidationError("toPocketId wajib diisi untuk transfer");
        }
        const toPocket = await stockistPocketRepository.findById(ctx.body.toPocketId);
        if (!toPocket) throw new NotFoundError("Pocket tujuan tidak ditemukan");
        assertCompanyAccess(caller, toPocket.companyId);

        const result = await stockistService.transferBetweenPockets({
          fromPocketId: ctx.body.pocketId,
          toPocketId: ctx.body.toPocketId,
          companyStockItemId: ctx.body.companyStockItemId,
          quantity: ctx.body.quantity,
          note: ctx.body.note,
          createdBy: caller.id,
        });
        return NextResponse.json(ok(result, "Transfer berhasil"), { status: 201 });
      }

      const mutation = await stockistService.applyStockistMutation({
        pocketId: ctx.body.pocketId,
        companyStockItemId: ctx.body.companyStockItemId,
        type: ctx.body.type as StockistMutationType,
        quantity: ctx.body.quantity,
        note: ctx.body.note,
        createdBy: caller.id,
      });
      return NextResponse.json(ok(mutation, "Mutasi berhasil dicatat"), { status: 201 });
    } catch (e) {
      return handleError(e);
    }
  }
);
