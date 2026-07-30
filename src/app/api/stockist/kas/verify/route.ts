import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { authorize } from "@/backend/helpers/authz";
import { withValidation } from "@/backend/middleware/with-validation";
import { dailyVerifyService } from "@/backend/services/daily-verify.service";
import { correctionService } from "@/backend/services/correction.service";
import { kasPocketRepository } from "@/backend/repositories/kas-pocket.repository";
import { NotFoundError } from "@/backend/errors/app-error";
import { allowsCompany } from "@/lib/authz/resolve";

const verifySchema = z.object({
  kasPocketId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["BENAR", "BEDA"]),
  note: z.string().max(500).optional(),
  correctedBalance: z.number().optional(),
});

type Body = z.infer<typeof verifySchema>;

// PATCH /api/stockist/kas/verify — konfirmasi H+1 saldo kas ("Sesuai" / "Tidak sesuai").
// Angka pengganti tidak langsung dipakai; dia jadi pengajuan koreksi.
//
// Seperti /api/bank-harian/verify: tanggal lampau memang inti alurnya, jadi
// tidak ada (dan tidak boleh ada) jalan pintas `daily.backdate` di sini.
// Yang boleh melewati antrean hanyalah pemegang `correction.direct` untuk PT ini.
export const PATCH = withValidation(verifySchema)(
  async (_req: NextRequest, ctx: { body: Body }) => {
    try {
      const caller = await authorize("stockist.daily", "write");
      if (caller instanceof NextResponse) return caller;

      const pocket = await kasPocketRepository.findById(ctx.body.kasPocketId);
      if (!pocket) throw new NotFoundError("Kas pocket tidak ditemukan");
      caller.assertCompany(pocket.companyId);

      const result = await dailyVerifyService.verifyKas({
        kasPocketId: ctx.body.kasPocketId,
        date: new Date(ctx.body.date),
        status: ctx.body.status,
        note: ctx.body.note,
        correctedBalance: ctx.body.correctedBalance,
        verifiedBy: caller.userId,
      });

      const canDirect = allowsCompany(
        caller.subject,
        "correction.direct",
        "write",
        pocket.companyId
      );

      if (result.correctionRequest && canDirect) {
        await correctionService.applyDirect(result.correctionRequest.id, caller.userId);
        return NextResponse.json(
          ok(
            { correctionRequestId: null, applied: true },
            "Saldo kas langsung dikoreksi — tanpa perlu persetujuan"
          )
        );
      }

      return NextResponse.json(
        ok(
          { correctionRequestId: result.correctionRequest?.id ?? null, applied: false },
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
