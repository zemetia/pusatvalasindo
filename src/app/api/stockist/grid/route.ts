import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { authorize } from "@/backend/helpers/authz";
import { buildStockistGridPayload } from "@/backend/services/stockist.service";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/stockist/grid?companyId=X&date=YYYY-MM-DD
// Grid lengkap: pockets x currencies x balance x status check hari itu (auto-upsert check rows kalau belum ada).
export async function GET(req: NextRequest) {
  try {
    const caller = await authorize("stockist.daily", "view");
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
    // stockist (initialGrid) — satu sumber kebenaran, tidak bisa beda bentuk.
    const payload = await buildStockistGridPayload(caller, companyId, new Date(dateStr));

    return NextResponse.json(ok(payload));
  } catch (e) {
    return handleError(e);
  }
}
