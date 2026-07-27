import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { requirePermission } from "@/backend/helpers/get-admin-caller";
import { withValidation } from "@/backend/middleware/with-validation";
import { PERMISSIONS } from "@/lib/permissions";
import { ForbiddenError, NotFoundError } from "@/backend/errors/app-error";
import { dailyVerifyService } from "@/backend/services/daily-verify.service";
import { bankAccountRepository } from "@/backend/repositories/bank-account.repository";

const verifySchema = z.object({
  bankAccountId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["BENAR", "BEDA"]),
  note: z.string().max(500).optional(),
  correctedBalance: z.number().optional(),
});

type Body = z.infer<typeof verifySchema>;

// PATCH /api/bank-harian/verify — konfirmasi H+1 saldo bank harian ("Sesuai" / "Tidak sesuai").
// Angka pengganti tidak langsung dipakai; dia jadi pengajuan koreksi (bank.daily_input).
export const PATCH = withValidation(verifySchema)(
  async (_req: NextRequest, ctx: { body: Body }) => {
    try {
      const caller = await requirePermission(PERMISSIONS.BANK_DAILY_INPUT);
      if (caller instanceof NextResponse) return caller;

      const account = await bankAccountRepository.findById(ctx.body.bankAccountId);
      if (!account) throw new NotFoundError("Rekening tidak ditemukan");
      if (caller.companyId && caller.companyId !== account.companyId) {
        throw new ForbiddenError("Tidak punya akses ke PT ini");
      }

      const result = await dailyVerifyService.verifyBank({
        bankAccountId: ctx.body.bankAccountId,
        date: new Date(ctx.body.date),
        status: ctx.body.status,
        note: ctx.body.note,
        correctedBalance: ctx.body.correctedBalance,
        verifiedBy: caller.id,
      });

      return NextResponse.json(
        ok(
          { correctionRequestId: result.correctionRequest?.id ?? null },
          result.correctionRequest
            ? "Ditandai Beda — koreksi menunggu persetujuan Owner/Super Admin"
            : "Verifikasi tersimpan"
        )
      );
    } catch (e) {
      return handleError(e);
    }
  }
);
