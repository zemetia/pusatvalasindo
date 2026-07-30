import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { authorize } from "@/backend/helpers/authz";
import { allowsCompany } from "@/lib/authz/resolve";
import { withValidation } from "@/backend/middleware/with-validation";
import { ForbiddenError } from "@/backend/errors/app-error";
import { dailyBankEntryRepository } from "@/backend/repositories/daily-bank-entry.repository";
import { todayDateOnly } from "@/backend/helpers/date-only";
import { buildBankHarianPayload } from "@/backend/services/bank-harian.service";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const entrySchema = z.object({
  bankAccountId: z.string().min(1),
  balance: z.number(),
  note: z.string().max(500).optional().nullable(),
});

const saveSchema = z.object({
  companyId: z.string().min(1),
  date: z.string().regex(DATE_RE),
  entries: z.array(entrySchema).min(1),
});

type SaveBody = z.infer<typeof saveSchema>;

/**
 * Hari berjalan boleh diisi siapa pun yang berhak menulis; tanggal yang sudah
 * lewat butuh kemampuan `daily.backdate` untuk PT itu — izin tersendiri yang
 * bisa didelegasikan, bukan lagi terkunci ke Super Admin/Owner.
 */
function assertEditableDate(canBackdate: boolean, date: Date) {
  const isPast = date.getTime() < todayDateOnly().getTime();
  if (isPast && !canBackdate) {
    throw new ForbiddenError("Tanggal sudah lewat — edit perlu izin ubah tanggal lampau");
  }
}

// GET /api/bank-harian?companyId=&date=YYYY-MM-DD
// List rekening bank aktif PT + entry hari itu (kalau ada) + entry sebelumnya (referensi delta).
export async function GET(req: NextRequest) {
  try {
    const companyId = req.nextUrl.searchParams.get("companyId");
    const dateStr = req.nextUrl.searchParams.get("date");
    if (!companyId || !dateStr || !DATE_RE.test(dateStr)) {
      return NextResponse.json(
        { error: "companyId dan date (YYYY-MM-DD) wajib diisi" },
        { status: 400 }
      );
    }
    // PT yang diminta ikut diperiksa terhadap scope baca — bukan cuma "punya izin bank".
    const authz = await authorize("bank.daily", "view", { companyId });
    if (authz instanceof NextResponse) return authz;
    // Payload dibangun di service supaya identik dengan yang dirender server di halaman
    // Bank Harian (initialGrid) — satu sumber kebenaran, tidak bisa beda bentuk.
    const payload = await buildBankHarianPayload(authz, companyId, new Date(dateStr));

    return NextResponse.json(ok(payload));
  } catch (e) {
    return handleError(e);
  }
}

// POST /api/bank-harian — body { companyId, date, entries: [{ bankAccountId, balance, note? }] }
// Upsert DailyBankEntry per rekening. Tidak menyentuh BankMutation sama sekali.
export const POST = withValidation(saveSchema)(
  async (_req: NextRequest, ctx: { body: SaveBody }) => {
    try {
      // Scope TULIS untuk PT yang dikirim. Inilah gerbang yang membuat sebuah
      // jabatan bisa memantau beberapa PT tapi hanya menginput di sebagian.
      const caller = await authorize("bank.daily", "write", { companyId: ctx.body.companyId });
      if (caller instanceof NextResponse) return caller;

      const accountIds = ctx.body.entries.map((e) => e.bankAccountId);
      const ownedCount = await prisma.bankAccount.count({
        where: { id: { in: accountIds }, companyId: ctx.body.companyId },
      });
      if (ownedCount !== new Set(accountIds).size) {
        throw new ForbiddenError("Ada rekening yang tidak termasuk PT ini");
      }

      const date = new Date(ctx.body.date);
      assertEditableDate(
        allowsCompany(caller.subject, "daily.backdate", "write", ctx.body.companyId),
        date
      );

      const saved = await dailyBankEntryRepository.upsertMany(
        ctx.body.entries.map((e) => ({ ...e, date, createdBy: caller.userId }))
      );

      return NextResponse.json(ok(saved, "Saldo bank harian tersimpan"));
    } catch (e) {
      return handleError(e);
    }
  }
);
