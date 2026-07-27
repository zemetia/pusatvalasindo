import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { requirePermission } from "@/backend/helpers/get-admin-caller";
import { PERMISSIONS } from "@/lib/permissions";
import { assertCompanyAccess, stockistService } from "@/backend/services/stockist.service";
import { correctionRequestRepository } from "@/backend/repositories/correction-request.repository";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/stockist/grid?companyId=X&date=YYYY-MM-DD
// Grid lengkap: pockets x currencies x balance x status check hari itu (auto-upsert check rows kalau belum ada).
export async function GET(req: NextRequest) {
  try {
    const caller = await requirePermission(PERMISSIONS.STOCKIST_VIEW);
    if (caller instanceof NextResponse) return caller;

    const companyId = req.nextUrl.searchParams.get("companyId");
    const dateStr = req.nextUrl.searchParams.get("date");
    if (!companyId || !dateStr || !DATE_RE.test(dateStr)) {
      return NextResponse.json(
        { error: "companyId dan date (YYYY-MM-DD) wajib diisi" },
        { status: 400 }
      );
    }
    assertCompanyAccess(caller, companyId);

    const canManage = caller.permissions.includes(PERMISSIONS.STOCKIST_MANAGE);
    const date = new Date(dateStr);
    // Satu kali ambil grid; alerts dihitung dari data yang sama (tanpa query duplikat).
    const [grid, pending] = await Promise.all([
      stockistService.getOrCreateGridForDate(companyId, date),
      correctionRequestRepository.findPendingByCompanyDateTargets(companyId, date, ["STOCKIST"]),
    ]);
    const alerts = stockistService.computeAlerts(grid.pockets, grid.currencies, grid.checks, date);

    // Sel yang koreksinya masih menunggu persetujuan ditandai di grid supaya user tidak
    // mengajukan ulang angka yang sama.
    const pendingCorrections = Object.fromEntries(
      pending
        .filter((c) => c.pocketId && c.companyStockItemId)
        .map((c) => [
          `${c.pocketId}:${c.companyStockItemId}`,
          { id: c.id, proposedValue: c.proposedValue.toString(), reason: c.reason },
        ])
    );

    return NextResponse.json(ok({ ...grid, alerts, canManage, pendingCorrections }));
  } catch (e) {
    return handleError(e);
  }
}
