import { NextResponse } from "next/server";
import { currencyPriceSyncService } from "@/backend/services/currency-price-sync.service";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { authorize } from "@/backend/helpers/authz";

/**
 * POST /api/harga-valas/sync — menyalurkan Patokan Harga ke Harga Valas.
 *
 * Dipakai oleh dua tombol sekaligus: "Sync sekarang" di halaman Harga Valas dan
 * "Terapkan ke Harga Valas" di halaman Patokan Harga. Keduanya operasi yang
 * sama persis, jadi keduanya route yang sama.
 *
 * Digerbangi izin TULIS Harga Valas — yang berubah angkanya di sana, bukan di
 * Patokan Harga.
 */
export async function POST() {
  try {
    const authz = await authorize("currency.price", "write");
    if (authz instanceof NextResponse) return authz;

    const result = await currencyPriceSyncService.run({ actor: authz.userId });
    return NextResponse.json(ok(result, result.summary));
  } catch (e) {
    return handleError(e);
  }
}
