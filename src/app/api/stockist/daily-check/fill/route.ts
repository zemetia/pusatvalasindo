import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { requirePermission } from "@/backend/helpers/get-admin-caller";
import { withValidation } from "@/backend/middleware/with-validation";
import { PERMISSIONS } from "@/lib/permissions";
import { assertCompanyAccess, stockistService } from "@/backend/services/stockist.service";
import { stockistPocketRepository } from "@/backend/repositories/stockist-pocket.repository";
import { NotFoundError } from "@/backend/errors/app-error";

const fillCheckSchema = z.object({
  pocketId: z.string().min(1),
  companyStockItemId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  quantity: z.number(),
});

type Body = z.infer<typeof fillCheckSchema>;

// PATCH /api/stockist/daily-check/fill — isi opname hari ini untuk satu sel (stockist.manage).
// Hanya bisa untuk tanggal hari ini dan hanya sekali; angka ini yang jadi bahan review besoknya.
export const PATCH = withValidation(fillCheckSchema)(
  async (_req: NextRequest, ctx: { body: Body }) => {
    try {
      const caller = await requirePermission(PERMISSIONS.STOCKIST_MANAGE);
      if (caller instanceof NextResponse) return caller;

      const pocket = await stockistPocketRepository.findById(ctx.body.pocketId);
      if (!pocket) throw new NotFoundError("Pocket tidak ditemukan");
      assertCompanyAccess(caller, pocket.companyId);

      const check = await stockistService.fillDailyCheck({
        pocketId: ctx.body.pocketId,
        companyStockItemId: ctx.body.companyStockItemId,
        date: new Date(ctx.body.date),
        quantity: ctx.body.quantity,
        filledBy: caller.id,
      });

      return NextResponse.json(ok(check, "Opname berhasil disimpan"));
    } catch (e) {
      return handleError(e);
    }
  }
);
