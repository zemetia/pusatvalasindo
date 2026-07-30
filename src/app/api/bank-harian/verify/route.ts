import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { authorize } from "@/backend/helpers/authz";
import { withValidation } from "@/backend/middleware/with-validation";
import { NotFoundError } from "@/backend/errors/app-error";
import { dailyVerifyService } from "@/backend/services/daily-verify.service";
import { correctionService } from "@/backend/services/correction.service";
import { bankAccountRepository } from "@/backend/repositories/bank-account.repository";
import { allowsCompany } from "@/lib/authz/resolve";

const verifySchema = z.object({
  bankAccountId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["BENAR", "BEDA"]),
  note: z.string().max(500).optional(),
  correctedBalance: z.number().optional(),
});

type Body = z.infer<typeof verifySchema>;

// PATCH /api/bank-harian/verify — konfirmasi H+1 saldo bank harian ("Sesuai" / "Tidak sesuai").
// Angka pengganti tidak langsung dipakai; dia jadi pengajuan koreksi.
//
// Tanggal lampau memang bagian dari alur ini (konfirmasi H+1), jadi TIDAK ada
// pemeriksaan `daily.backdate` di sini — dan sengaja tidak ditambahkan sebagai
// jalan pintas: angka yang berbeda tetap harus lewat persetujuan koreksi.
//
// Satu-satunya pengecualian adalah pemegang `correction.direct` untuk PT rekening
// ini: pengajuannya tetap dibuat, lalu langsung disetujui atas namanya sendiri.
export const PATCH = withValidation(verifySchema)(
  async (_req: NextRequest, ctx: { body: Body }) => {
    try {
      const caller = await authorize("bank.daily", "write");
      if (caller instanceof NextResponse) return caller;

      const account = await bankAccountRepository.findById(ctx.body.bankAccountId);
      if (!account) throw new NotFoundError("Rekening tidak ditemukan");
      // PT rekening diuji terhadap scope TULIS. Pemeriksaan lama hanya
      // membandingkan dengan PT si pemanggil, jadi pemanggil tanpa PT (companyId
      // null) lolos untuk rekening PT mana pun.
      caller.assertCompany(account.companyId);

      const result = await dailyVerifyService.verifyBank({
        bankAccountId: ctx.body.bankAccountId,
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
        account.companyId
      );

      if (result.correctionRequest && canDirect) {
        await correctionService.applyDirect(result.correctionRequest.id, caller.userId);
        return NextResponse.json(
          ok(
            { correctionRequestId: null, applied: true },
            "Saldo langsung dikoreksi — tanpa perlu persetujuan"
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
