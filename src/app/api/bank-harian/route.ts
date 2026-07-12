import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { requirePermission } from "@/backend/helpers/get-admin-caller";
import { withValidation } from "@/backend/middleware/with-validation";
import { PERMISSIONS } from "@/lib/permissions";
import { ForbiddenError } from "@/backend/errors/app-error";
import { bankAccountRepository } from "@/backend/repositories/bank-account.repository";
import { dailyBankEntryRepository } from "@/backend/repositories/daily-stock-entry.repository";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const entrySchema = z.object({
  bankAccountId: z.string().min(1),
  balance: z.number(),
  tarikCek: z.number().default(0),
  note: z.string().max(500).optional().nullable(),
});

const saveSchema = z.object({
  companyId: z.string().min(1),
  date: z.string().regex(DATE_RE),
  entries: z.array(entrySchema).min(1),
});

type SaveBody = z.infer<typeof saveSchema>;

// GET /api/bank-harian?companyId=&date=YYYY-MM-DD
// List rekening bank aktif PT + entry hari itu (kalau ada) + entry sebelumnya (referensi delta).
export async function GET(req: NextRequest) {
  try {
    const caller = await requirePermission(PERMISSIONS.BANK_VIEW);
    if (caller instanceof NextResponse) return caller;

    const companyId = req.nextUrl.searchParams.get("companyId");
    const dateStr = req.nextUrl.searchParams.get("date");
    if (!companyId || !dateStr || !DATE_RE.test(dateStr)) {
      return NextResponse.json(
        { error: "companyId dan date (YYYY-MM-DD) wajib diisi" },
        { status: 400 }
      );
    }
    if (caller.companyId && caller.companyId !== companyId) {
      return NextResponse.json({ error: "Tidak punya akses ke PT ini" }, { status: 403 });
    }

    const date = new Date(dateStr);
    const [accounts, todayEntries, previousEntries] = await Promise.all([
      bankAccountRepository.findAll(companyId, true),
      dailyBankEntryRepository.findByCompanyAndDate(companyId, date),
      dailyBankEntryRepository.findLatestBeforeDate(companyId, date),
    ]);

    const canInput = caller.permissions.includes(PERMISSIONS.BANK_DAILY_INPUT);

    return NextResponse.json(
      ok({
        accounts: accounts.map((a) => ({
          id: a.id,
          bankName: a.bankName,
          accountNumber: a.accountNumber,
          accountName: a.accountName,
          currencyCode: a.currency.code,
          referenceBalance: a.balance.toString(),
          sortOrder: a.sortOrder,
        })),
        entries: Object.fromEntries(
          todayEntries.map((e) => [
            e.bankAccountId,
            { balance: e.balance.toString(), tarikCek: e.tarikCek.toString(), note: e.note },
          ])
        ),
        previous: Object.fromEntries(
          previousEntries.map((e) => [
            e.bankAccountId,
            { balance: e.balance.toString(), date: e.date.toISOString().slice(0, 10) },
          ])
        ),
        canInput,
      })
    );
  } catch (e) {
    return handleError(e);
  }
}

// POST /api/bank-harian — body { companyId, date, entries: [{ bankAccountId, balance, tarikCek?, note? }] }
// Upsert DailyBankEntry per rekening. Tidak menyentuh BankMutation sama sekali.
export const POST = withValidation(saveSchema)(
  async (_req: NextRequest, ctx: { body: SaveBody }) => {
    try {
      const caller = await requirePermission(PERMISSIONS.BANK_DAILY_INPUT);
      if (caller instanceof NextResponse) return caller;
      if (caller.companyId && caller.companyId !== ctx.body.companyId) {
        throw new ForbiddenError("Tidak punya akses ke PT ini");
      }

      const accountIds = ctx.body.entries.map((e) => e.bankAccountId);
      const ownedCount = await prisma.bankAccount.count({
        where: { id: { in: accountIds }, companyId: ctx.body.companyId },
      });
      if (ownedCount !== new Set(accountIds).size) {
        throw new ForbiddenError("Ada rekening yang tidak termasuk PT ini");
      }

      const date = new Date(ctx.body.date);
      const saved = await dailyBankEntryRepository.upsertMany(
        ctx.body.entries.map((e) => ({ ...e, date, createdBy: caller.id }))
      );

      return NextResponse.json(ok(saved, "Saldo bank harian tersimpan"));
    } catch (e) {
      return handleError(e);
    }
  }
);
