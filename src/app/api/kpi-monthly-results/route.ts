import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";
import { kpiService } from "@/backend/services/kpi.service";
import { ok, fail } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { getAuthzCaller } from "@/backend/helpers/authz";

export async function GET(req: NextRequest) {
  try {
    const caller = await getAuthzCaller();
    if (!caller) {
      return NextResponse.json(fail("UNAUTHORIZED", "Tidak terautentikasi"), { status: 401 });
    }

    const employeeId = req.nextUrl.searchParams.get("employeeId") ?? caller.id;
    const month = Number(req.nextUrl.searchParams.get("month"));
    const year = Number(req.nextUrl.searchParams.get("year"));

    if (!month || !year) {
      return NextResponse.json(fail("VALIDATION", "month dan year diperlukan"), { status: 400 });
    }

    // Skor sendiri selalu boleh dilihat; skor orang lain butuh scope BACA
    // `kpi.review` yang mencakup PT karyawan itu — gerbang yang sama dengan
    // /api/kpi-entries, jadi keduanya tidak bisa berbeda pendapat.
    await kpiService.assertCanViewEntriesOf(caller, employeeId);

    return NextResponse.json(ok(await kpiService.getMonthlyResult(employeeId, month, year)));
  } catch (e) {
    return handleError(e);
  }
}
