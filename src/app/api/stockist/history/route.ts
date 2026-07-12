import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { requirePermission } from "@/backend/helpers/get-admin-caller";
import { PERMISSIONS } from "@/lib/permissions";
import { assertCompanyAccess } from "@/backend/services/stockist.service";
import { stockistMutationRepository } from "@/backend/repositories/stockist-mutation.repository";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/stockist/history?companyId=&pocketId=&from=&to=&take=&cursor=
export async function GET(req: NextRequest) {
  try {
    const caller = await requirePermission(PERMISSIONS.STOCKIST_VIEW);
    if (caller instanceof NextResponse) return caller;

    const companyId = req.nextUrl.searchParams.get("companyId");
    if (!companyId) {
      return NextResponse.json({ error: "companyId wajib diisi" }, { status: 400 });
    }
    assertCompanyAccess(caller, companyId);

    const pocketId = req.nextUrl.searchParams.get("pocketId") ?? undefined;
    const fromStr = req.nextUrl.searchParams.get("from");
    const toStr = req.nextUrl.searchParams.get("to");
    const cursor = req.nextUrl.searchParams.get("cursor") ?? undefined;
    const takeParam = Number(req.nextUrl.searchParams.get("take") ?? "50");
    const take = Number.isFinite(takeParam) ? Math.min(Math.max(takeParam, 1), 200) : 50;

    if ((fromStr && !DATE_RE.test(fromStr)) || (toStr && !DATE_RE.test(toStr))) {
      return NextResponse.json({ error: "from/to harus format YYYY-MM-DD" }, { status: 400 });
    }

    const rows = await stockistMutationRepository.findPage(
      {
        companyId,
        pocketId,
        from: fromStr ? new Date(fromStr) : undefined,
        to: toStr ? new Date(toStr) : undefined,
      },
      take,
      cursor
    );

    const hasMore = rows.length > take;
    const items = hasMore ? rows.slice(0, take) : rows;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    return NextResponse.json(ok({ items, nextCursor }));
  } catch (e) {
    return handleError(e);
  }
}
