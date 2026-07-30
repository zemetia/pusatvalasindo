import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { authorize } from "@/backend/helpers/authz";
import { withValidation } from "@/backend/middleware/with-validation";
import { stockistService } from "@/backend/services/stockist.service";
import { correctionService } from "@/backend/services/correction.service";
import { stockistPocketRepository } from "@/backend/repositories/stockist-pocket.repository";
import type { StockistCheckStatus } from "@src/generated/prisma/client";
import { NotFoundError } from "@/backend/errors/app-error";
import { allowsCompany } from "@/lib/authz/resolve";

const markCheckSchema = z.object({
  pocketId: z.string().min(1),
  companyStockItemId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["BENAR", "BEDA"]),
  note: z.string().max(500).optional(),
  correctedQuantity: z.number().optional(),
});

type Body = z.infer<typeof markCheckSchema>;

// PATCH /api/stockist/daily-check — aksi klik "Tandai Benar"/"Tandai Beda" (stockist.manage)
export const PATCH = withValidation(markCheckSchema)(
  async (_req: NextRequest, ctx: { body: Body }) => {
    try {
      const caller = await authorize("stockist.daily", "write");
      if (caller instanceof NextResponse) return caller;

      const pocket = await stockistPocketRepository.findById(ctx.body.pocketId);
      if (!pocket) throw new NotFoundError("Pocket tidak ditemukan");
      caller.assertCompany(pocket.companyId);

      const result = await stockistService.markDailyCheck({
        pocketId: ctx.body.pocketId,
        companyStockItemId: ctx.body.companyStockItemId,
        date: new Date(ctx.body.date),
        status: ctx.body.status as StockistCheckStatus,
        note: ctx.body.note,
        correctedQuantity: ctx.body.correctedQuantity,
        reviewedBy: caller.userId,
      });

      // Pemegang `correction.direct` untuk PT ini tidak mengantre: pengajuannya
      // tetap dibuat (jejak angka lama, angka baru, dan alasan), lalu langsung
      // disetujui atas namanya sendiri.
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
            { ...result.check, correctionRequestId: null, applied: true },
            "Stock langsung dikoreksi — tanpa perlu persetujuan"
          )
        );
      }

      return NextResponse.json(
        ok(
          {
            ...result.check,
            correctionRequestId: result.correctionRequest?.id ?? null,
            applied: false,
          },
          result.correctionRequest
            ? "Ditandai Beda — koreksi menunggu persetujuan Owner/Super Admin"
            : "Status berhasil disimpan"
        )
      );
    } catch (e) {
      return handleError(e);
    }
  }
);
