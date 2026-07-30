import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { authorize } from "@/backend/helpers/authz";
import { allowsCompany } from "@/lib/authz/resolve";
import { withValidation } from "@/backend/middleware/with-validation";
import { kasPocketRepository } from "@/backend/repositories/kas-pocket.repository";
import { kasDailyEntryRepository } from "@/backend/repositories/kas-daily-entry.repository";
import { correctionRequestRepository } from "@/backend/repositories/correction-request.repository";
import { isPastDate, todayDateOnly } from "@/backend/helpers/date-only";
import { ForbiddenError, NotFoundError } from "@/backend/errors/app-error";

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
    const caller = await authorize("stockist.daily", "view");
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
    const [pockets, todayEntries, previousEntries, pendingCorrections, approvedCorrections] = await Promise.all([
      kasPocketRepository.findAllByCompany(companyId, true),
      kasDailyEntryRepository.findByCompanyAndDate(companyId, date),
      kasDailyEntryRepository.findLatestBeforeDate(companyId, date),
      correctionRequestRepository.findPendingByCompanyDateTargets(companyId, date, ["KAS"]),
      correctionRequestRepository.findApprovedByCompanyDateTargets(companyId, date, ["KAS"]),
    ]);

    const canManage = caller.can("stockist.daily", "write");

    return NextResponse.json(
      ok({
        pockets,
        serverDate: todayDateOnly().toISOString().slice(0, 10),
        entries: Object.fromEntries(
          todayEntries.map((e) => [
            e.kasPocketId,
            {
              balance: e.balance.toString(),
              note: e.note,
              verifyStatus: e.verifyStatus,
              verifyNote: e.verifyNote,
            },
          ])
        ),
        // Sel yang koreksinya masih menunggu persetujuan ditandai di grid supaya user tidak
        // mengajukan ulang angka yang sama.
        pendingCorrections: Object.fromEntries(
          pendingCorrections
            .filter((c) => c.kasPocketId)
            .map((c) => [
              c.kasPocketId as string,
              { id: c.id, proposedValue: c.proposedValue.toString(), reason: c.reason },
            ])
        ),
        // Sel yang pernah salah dan sudah dikoreksi (disetujui) ditandai supaya kelihatan
        // riwayatnya, beda dari pendingCorrections yang masih menunggu ACC.
        approvedCorrections: Object.fromEntries(
          approvedCorrections
            .filter((c) => c.kasPocketId)
            .map((c) => [
              c.kasPocketId as string,
              {
                id: c.id,
                currentValue: c.currentValue.toString(),
                proposedValue: c.proposedValue.toString(),
                reason: c.reason,
              },
            ])
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
      const caller = await authorize("stockist.daily", "write");
      if (caller instanceof NextResponse) return caller;

      const pocket = await kasPocketRepository.findById(ctx.body.kasPocketId);
      if (!pocket) throw new NotFoundError("Kas pocket tidak ditemukan");
      caller.assertCompany(pocket.companyId);

      // Saldo tanggal lampau sudah masuk alur verifikasi H+1 — mengubahnya wajib
      // lewat pengajuan koreksi yang disetujui, kecuali pemegang izin ubah
      // tanggal lampau untuk PT ini (sejalan dengan /api/bank-harian).
      // PT-nya diambil dari pocket, karena body tidak membawa companyId.
      const canBackdate = allowsCompany(caller.subject, "daily.backdate", "write", pocket.companyId);
      if (isPastDate(new Date(ctx.body.date)) && !canBackdate) {
        throw new ForbiddenError(
          "Tanggal sudah lewat — ubah lewat pengajuan koreksi atau minta Super Admin"
        );
      }

      const entry = await kasDailyEntryRepository.upsert({
        kasPocketId: ctx.body.kasPocketId,
        date: new Date(ctx.body.date),
        balance: ctx.body.balance,
        note: ctx.body.note,
        createdBy: caller.userId,
      });

      return NextResponse.json(ok(entry, "Saldo kas tersimpan"));
    } catch (e) {
      return handleError(e);
    }
  }
);
