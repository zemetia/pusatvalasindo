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

// GET /api/stockist/head-confirmation?companyId=X&date=YYYY-MM-DD
// Grid konfirmasi kepala cabang untuk stock (mata uang + logam mulia): total sistem vs total
// hitung ulang kepala cabang, plus total keseluruhan IDR PT hari itu.
export async function GET(req: NextRequest) {
  try {
    const caller = await requirePermission(PERMISSIONS.STOCKIST_VERIFY);
    if (caller instanceof NextResponse) return caller;

    const companyId = req.nextUrl.searchParams.get("companyId");
    const dateStr = req.nextUrl.searchParams.get("date");
    if (!companyId || !dateStr || !DATE_RE.test(dateStr)) {
      return NextResponse.json(
        { error: "companyId dan date (YYYY-MM-DD) wajib diisi" },
        { status: 400 }
      );
    }
    assertCompanyAccess(caller, companyId);

    const date = new Date(dateStr);
    const [rows, companyTotal] = await Promise.all([
      stockistHeadConfirmationService.getStockConfirmationGrid(companyId, date),
      stockistHeadConfirmationService.getCompanyTotal(companyId, date),
    ]);

    return NextResponse.json(
      ok({ rows, companyTotal: companyTotal ? Number(companyTotal.totalIdr) : 0 })
    );
  } catch (e) {
    return handleError(e);
  }
}

const upsertSchema = z.object({
  companyId: z.string().min(1),
  companyStockItemId: z.string().min(1),
  date: z.string().regex(DATE_RE),
  confirmedQuantity: z.number(),
  confirmedIdrValue: z.number(),
  note: z.string().optional(),
});

type Body = z.infer<typeof upsertSchema>;

// PATCH /api/stockist/head-confirmation — simpan konfirmasi kepala cabang untuk satu stock item.
export const PATCH = withValidation(upsertSchema)(
  async (_req: NextRequest, ctx: { body: Body }) => {
    try {
      const caller = await requirePermission(PERMISSIONS.STOCKIST_VERIFY);
      if (caller instanceof NextResponse) return caller;

      assertCompanyAccess(caller, ctx.body.companyId);

      const result = await stockistHeadConfirmationService.upsertStockConfirmation({
        companyId: ctx.body.companyId,
        companyStockItemId: ctx.body.companyStockItemId,
        date: new Date(ctx.body.date),
        confirmedQuantity: ctx.body.confirmedQuantity,
        confirmedIdrValue: ctx.body.confirmedIdrValue,
        note: ctx.body.note,
        caller,
      });

      return NextResponse.json(ok(result, "Konfirmasi berhasil disimpan"));
    } catch (e) {
      return handleError(e);
    }
  }
);
