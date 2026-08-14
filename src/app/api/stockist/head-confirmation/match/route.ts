import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { authorize } from "@/backend/helpers/authz";
import { stockistHeadConfirmationService } from "@/backend/services/stockist-head-confirmation.service";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/stockist/head-confirmation/match?companyId=&date=&kind=kas|bank|stock
 *
 * Ringkasan cross-check yang dibaca dari halaman Stock & Kas dan Bank Harian: berapa
 * angka kepala cabang untuk tanggal itu, apakah sudah klop dengan total sistem, dan
 * jam klopnya. Sengaja terpisah dari `/api/stockist/{kas,bank}/head-confirmation`,
 * yang dijaga izin cross-check (`stockist.verify`) — di sini angkanya hanya DIBACA
 * sebagai pembanding, jadi izinnya mengikuti halaman yang menampilkannya: grid kas &
 * stock pakai `stockist.daily`, grid bank harian pakai `bank.daily`.
 *
 * Membaca ringkasannya sekaligus menandai klop + menyimpan jamnya (lihat
 * reconcileMatch di service) — jadi saldo yang baru dibetulkan di halaman ini
 * langsung menutup cross-check-nya tanpa perlu kepala cabang menyimpan ulang.
 */
export async function GET(req: NextRequest) {
  try {
    const companyId = req.nextUrl.searchParams.get("companyId");
    const dateStr = req.nextUrl.searchParams.get("date");
    const kind = req.nextUrl.searchParams.get("kind");

    if (!companyId || !dateStr || !DATE_RE.test(dateStr)) {
      return NextResponse.json(
        { error: "companyId dan date (YYYY-MM-DD) wajib diisi" },
        { status: 400 }
      );
    }
    if (kind !== "kas" && kind !== "bank" && kind !== "stock") {
      return NextResponse.json({ error: "kind harus kas, bank, atau stock" }, { status: 400 });
    }

    const caller = await authorize(kind === "bank" ? "bank.daily" : "stockist.daily", "view");
    if (caller instanceof NextResponse) return caller;
    caller.assertCompany(companyId);

    const date = new Date(dateStr);

    if (kind === "kas") {
      return NextResponse.json(
        ok(await stockistHeadConfirmationService.getKasConfirmation(companyId, date))
      );
    }
    if (kind === "bank") {
      return NextResponse.json(
        ok(await stockistHeadConfirmationService.getBankConfirmation(companyId, date))
      );
    }

    // Total IDR stock tidak punya pembanding sistem (kepala cabang mengisi satu angka
    // final), jadi yang dikirim hanya angkanya + jam pengisiannya.
    const total = await stockistHeadConfirmationService.getStockTotalConfirmation(companyId, date);
    return NextResponse.json(
      ok({
        confirmedIdrValue: total ? Number(total.confirmedIdrValue) : null,
        confirmedAt: total?.confirmedAt ?? null,
      })
    );
  } catch (e) {
    return handleError(e);
  }
}
