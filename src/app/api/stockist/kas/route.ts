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
import { kasDailyEntryRepository } from "@/backend/repositories/kas-daily-entry.repository";
import { NotFoundError } from "@/backend/errors/app-error";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const upsertEntrySchema = z.object({
  kasPocketId: z.string().min(1),
  date: z.string().regex(DATE_RE),
  balance: z.number(),
  note: z.string().max(500).optional().nullable(),
});

type UpsertBody = z.infer<typeof upsertEntrySchema>;

// GET /api/stockist/kas?companyId=&date=YYYY-MM-DD
// List KasPocket aktif PT + entry hari itu (kalau ada) + entry sebelumnya (referensi delta).
export async function GET(req: NextRequest) {
  try {
    const caller = await requirePermission(PERMISSIONS.STOCKIST_VIEW);
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
    const [pockets, todayEntries, previousEntries] = await Promise.all([
      kasPocketRepository.findAllByCompany(companyId, true),
      kasDailyEntryRepository.findByCompanyAndDate(companyId, date),
      kasDailyEntryRepository.findLatestBeforeDate(companyId, date),
    ]);

    const canManage = caller.permissions.includes(PERMISSIONS.STOCKIST_MANAGE);

    return NextResponse.json(
      ok({
        pockets,
        entries: Object.fromEntries(
          todayEntries.map((e) => [e.kasPocketId, { balance: e.balance.toString(), note: e.note }])
        ),
        previous: Object.fromEntries(
          previousEntries.map((e) => [
            e.kasPocketId,
            { balance: e.balance.toString(), date: e.date.toISOString().slice(0, 10) },
          ])
        ),
        canManage,
      })
    );
  } catch (e) {
    return handleError(e);
  }
}

// PATCH /api/stockist/kas — body { kasPocketId, date, balance, note? }, upsert KasDailyEntry (stockist.manage)
export const PATCH = withValidation(upsertEntrySchema)(
  async (_req: NextRequest, ctx: { body: UpsertBody }) => {
    try {
      const caller = await requirePermission(PERMISSIONS.STOCKIST_MANAGE);
      if (caller instanceof NextResponse) return caller;

      const pocket = await kasPocketRepository.findById(ctx.body.kasPocketId);
      if (!pocket) throw new NotFoundError("Kas pocket tidak ditemukan");
      assertCompanyAccess(caller, pocket.companyId);

      const entry = await kasDailyEntryRepository.upsert({
        kasPocketId: ctx.body.kasPocketId,
        date: new Date(ctx.body.date),
        balance: ctx.body.balance,
        note: ctx.body.note,
        createdBy: caller.id,
      });

      return NextResponse.json(ok(entry, "Saldo kas tersimpan"));
    } catch (e) {
      return handleError(e);
    }
  }
);
