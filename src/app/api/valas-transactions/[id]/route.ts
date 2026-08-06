import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { authorize } from "@/backend/helpers/authz";
import { withValidation } from "@/backend/middleware/with-validation";
import { valasTransactionService } from "@/backend/services/valas-transaction.service";

type Params = { params: Promise<{ id: string }> };

const voidSchema = z.object({
  // Alasan wajib: transaksi yang dianulir tanpa keterangan tidak bisa
  // dipertanggungjawabkan saat rekapnya tidak cocok dengan setoran kas.
  reason: z.string().min(3).max(300),
});

type VoidBody = z.infer<typeof voidSchema>;

/** GET /api/valas-transactions/[id] — satu transaksi, untuk cetak ulang bukti. */
export async function GET(_req: NextRequest, ctx: Params) {
  try {
    // PT-nya baru diketahui setelah barisnya dibaca, jadi gerbang PT ditegakkan
    // lewat `assertCompany` di bawah, bukan lewat opsi companyId di sini.
    const authz = await authorize("valas.transaction", "view");
    if (authz instanceof NextResponse) return authz;

    const { id } = await ctx.params;
    const row = await valasTransactionService.getById(id);
    authz.assertCompany(row.companyId);

    return NextResponse.json(ok(row));
  } catch (e) {
    return handleError(e);
  }
}

/**
 * PATCH /api/valas-transactions/[id] — membatalkan transaksi (status VOID).
 *
 * Tidak ada endpoint ubah isi dan tidak ada DELETE, dan itu disengaja: bukti
 * bernomor yang sudah diserahkan ke nasabah tidak boleh berubah angkanya
 * diam-diam. Salah catat dibatalkan dengan alasan, lalu dibuat ulang.
 *
 * Digerbangi `valas.transaction.void` — kemampuan tersendiri, terpisah dari hak
 * mencatat: yang membuat penjualan tidak boleh menganulir penjualannya sendiri.
 */
export const PATCH = withValidation(voidSchema)(
  async (_req: NextRequest, ctx: Params & { body: VoidBody }) => {
    try {
      const authz = await authorize("valas.transaction.void", "write");
      if (authz instanceof NextResponse) return authz;

      const { id } = await ctx.params;
      const existing = await valasTransactionService.getById(id);
      authz.assertCompany(existing.companyId);

      const row = await valasTransactionService.void(id, ctx.body.reason, authz.userId);
      return NextResponse.json(ok(row, `Transaksi ${row.invoiceNo} dibatalkan`));
    } catch (e) {
      return handleError(e);
    }
  }
);
