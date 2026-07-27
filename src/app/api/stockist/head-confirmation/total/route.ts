import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { requirePermission } from "@/backend/helpers/get-admin-caller";
import { withValidation } from "@/backend/middleware/with-validation";
import { PERMISSIONS } from "@/lib/permissions";
import { assertCompanyAccess } from "@/backend/services/stockist.service";
import { stockistHeadConfirmationService } from "@/backend/services/stockist-head-confirmation.service";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const upsertSchema = z.object({
  companyId: z.string().min(1),
  date: z.string().regex(DATE_RE),
  confirmedIdrValue: z.number(),
  note: z.string().optional(),
});

type Body = z.infer<typeof upsertSchema>;

// PATCH /api/stockist/head-confirmation/total — satu total IDR final untuk seluruh stock
// (valas + logam mulia) pada tanggal itu, bukan per item.
export const PATCH = withValidation(upsertSchema)(
  async (_req: NextRequest, ctx: { body: Body }) => {
    try {
      const caller = await requirePermission(PERMISSIONS.STOCKIST_VERIFY);
      if (caller instanceof NextResponse) return caller;

      assertCompanyAccess(caller, ctx.body.companyId);

      const result = await stockistHeadConfirmationService.upsertStockTotalConfirmation({
        companyId: ctx.body.companyId,
        date: new Date(ctx.body.date),
        confirmedIdrValue: ctx.body.confirmedIdrValue,
        note: ctx.body.note,
        caller,
      });

      // companyTotal ikut di respons — client memakainya langsung tanpa GET ulang.
      return NextResponse.json(
        ok(
          { confirmation: result.confirmation, companyTotal: result.companyTotal },
          "Total IDR stock berhasil disimpan"
        )
      );
    } catch (e) {
      return handleError(e);
    }
  }
);
