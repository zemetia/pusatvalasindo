import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { authorize } from "@/backend/helpers/authz";
import { allowsCompany } from "@/lib/authz/resolve";
import { withValidation } from "@/backend/middleware/with-validation";
import { stockistHeadConfirmationService } from "@/backend/services/stockist-head-confirmation.service";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/stockist/head-confirmation?companyId=X&date=YYYY-MM-DD
// Grid konfirmasi kepala cabang untuk stock (mata uang + logam mulia): total sistem vs total
// hitung ulang kepala cabang, plus baris total stock, kas, bank, dan total keseluruhan IDR PT.
export async function GET(req: NextRequest) {
  try {
    const caller = await authorize("stockist.verify", "write");
    if (caller instanceof NextResponse) return caller;

    const companyId = req.nextUrl.searchParams.get("companyId");
    const dateStr = req.nextUrl.searchParams.get("date");
    if (!companyId || !dateStr || !DATE_RE.test(dateStr)) {
      return NextResponse.json(
        { error: "companyId dan date (YYYY-MM-DD) wajib diisi" },
        { status: 400 }
      );
    }
    caller.assertCompany(companyId);

    const date = new Date(dateStr);
    // Satu batch query paralel untuk seluruh halaman: stock grid + kas + total PT.
    const data = await stockistHeadConfirmationService.getFullConfirmation(companyId, date);

    return NextResponse.json(ok(data));
  } catch (e) {
    return handleError(e);
  }
}

const upsertSchema = z.object({
  companyId: z.string().min(1),
  companyStockItemId: z.string().min(1),
  date: z.string().regex(DATE_RE),
  confirmedQuantity: z.number(),
  note: z.string().optional(),
});

type Body = z.infer<typeof upsertSchema>;

// PATCH /api/stockist/head-confirmation — simpan kuantitas hitung ulang kepala cabang untuk
// satu stock item. Nilai IDR-nya diisi terpisah sebagai satu total final di /total.
export const PATCH = withValidation(upsertSchema)(
  async (_req: NextRequest, ctx: { body: Body }) => {
    try {
      const caller = await authorize("stockist.verify", "write");
      if (caller instanceof NextResponse) return caller;

      caller.assertCompany(ctx.body.companyId);

      const confirmation = await stockistHeadConfirmationService.upsertStockConfirmation({
        companyId: ctx.body.companyId,
        companyStockItemId: ctx.body.companyStockItemId,
        date: new Date(ctx.body.date),
        confirmedQuantity: ctx.body.confirmedQuantity,
        note: ctx.body.note,
        caller: {
          id: caller.userId,
          // Hak backdate dinilai untuk PT yang sedang disentuh, bukan sekali di depan.
          canBackdate: allowsCompany(caller.subject, "daily.backdate", "write", ctx.body.companyId),
        },
      });

      return NextResponse.json(ok({ confirmation }, "Konfirmasi berhasil disimpan"));
    } catch (e) {
      return handleError(e);
    }
  }
);
