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

// GET /api/stockist/bank/head-confirmation?companyId=X&date=YYYY-MM-DD
// Ringkasan konfirmasi bank kepala cabang: total sistem (sum saldo Bank Harian semua rekening
// aktif PT) vs total hitung ulang kepala cabang.
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
    const confirmation = await stockistHeadConfirmationService.getBankConfirmation(companyId, date);

    return NextResponse.json(ok(confirmation));
  } catch (e) {
    return handleError(e);
  }
}

const upsertSchema = z.object({
  companyId: z.string().min(1),
  date: z.string().regex(DATE_RE),
  confirmedIdrValue: z.number(),
  note: z.string().optional(),
});

type Body = z.infer<typeof upsertSchema>;

// PATCH /api/stockist/bank/head-confirmation — simpan konfirmasi total bank kepala cabang.
export const PATCH = withValidation(upsertSchema)(
  async (_req: NextRequest, ctx: { body: Body }) => {
    try {
      const caller = await authorize("stockist.verify", "write");
      if (caller instanceof NextResponse) return caller;

      caller.assertCompany(ctx.body.companyId);

      const result = await stockistHeadConfirmationService.upsertBankConfirmation({
        companyId: ctx.body.companyId,
        date: new Date(ctx.body.date),
        confirmedIdrValue: ctx.body.confirmedIdrValue,
        note: ctx.body.note,
        caller: {
          id: caller.userId,
          // Hak backdate dinilai untuk PT yang sedang disentuh.
          canBackdate: allowsCompany(caller.subject, "daily.backdate", "write", ctx.body.companyId),
        },
      });

      // companyTotal ikut di respons — client memakainya langsung tanpa GET ulang.
      return NextResponse.json(
        ok(
          { confirmation: result.confirmation, companyTotal: result.companyTotal },
          "Konfirmasi bank berhasil disimpan"
        )
      );
    } catch (e) {
      return handleError(e);
    }
  }
);
