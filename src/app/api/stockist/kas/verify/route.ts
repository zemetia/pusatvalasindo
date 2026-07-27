import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { requirePermission } from "@/backend/helpers/get-admin-caller";
import { withValidation } from "@/backend/middleware/with-validation";
import { PERMISSIONS } from "@/lib/permissions";
import { assertCompanyAccess } from "@/backend/services/stockist.service";
import { dailyVerifyService } from "@/backend/services/daily-verify.service";
import { kasPocketRepository } from "@/backend/repositories/kas-pocket.repository";
import { NotFoundError } from "@/backend/errors/app-error";

const verifySchema = z.object({
  kasPocketId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["BENAR", "BEDA"]),
  note: z.string().max(500).optional(),
  correctedBalance: z.number().optional(),
});

type Body = z.infer<typeof verifySchema>;

// PATCH /api/stockist/kas/verify — konfirmasi H+1 saldo kas ("Sesuai" / "Tidak sesuai").
// Angka pengganti tidak langsung dipakai; dia jadi pengajuan koreksi (stockist.manage).
export const PATCH = withValidation(verifySchema)(
  async (_req: NextRequest, ctx: { body: Body }) => {
    try {
      const caller = await requirePermission(PERMISSIONS.STOCKIST_MANAGE);
      if (caller instanceof NextResponse) return caller;

      const pocket = await kasPocketRepository.findById(ctx.body.kasPocketId);
      if (!pocket) throw new NotFoundError("Kas pocket tidak ditemukan");
      assertCompanyAccess(caller, pocket.companyId);

      const result = await dailyVerifyService.verifyKas({
        kasPocketId: ctx.body.kasPocketId,
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
