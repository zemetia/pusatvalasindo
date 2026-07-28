import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { requirePermission } from "@/backend/helpers/get-admin-caller";
import { withValidation } from "@/backend/middleware/with-validation";
import { isGlobalRole, PERMISSIONS } from "@/lib/permissions";
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

/** Anyone with BANK_DAILY_INPUT can edit today's entry; editing a past date requires Super Admin/Owner. */
function assertEditableDate(roleName: string, date: Date) {
  const isPast = date.getTime() < todayDateOnly().getTime();
  if (isPast && !isGlobalRole(roleName)) {
    throw new ForbiddenError("Tanggal sudah lewat — edit perlu otorisasi Super Admin");
  }
}

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
    // Payload dibangun di service supaya identik dengan yang dirender server di halaman
    // Bank Harian (initialGrid) — satu sumber kebenaran, tidak bisa beda bentuk.
    const payload = await buildBankHarianPayload(caller, companyId, new Date(dateStr));

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
      assertEditableDate(caller.roleName, date);

      const saved = await dailyBankEntryRepository.upsertMany(
        ctx.body.entries.map((e) => ({ ...e, date, createdBy: caller.id }))
      );

      return NextResponse.json(ok(saved, "Saldo bank harian tersimpan"));
    } catch (e) {
      return handleError(e);
    }
  }
);
