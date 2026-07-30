import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";
import { kpiService } from "@/backend/services/kpi.service";
import { ok, fail } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { getAuthzCaller } from "@/backend/helpers/authz";

/** Antrian entri KPI yang menunggu persetujuan, dibatasi PT si peninjau. */
export async function GET(_req: NextRequest) {
  try {
    const caller = await getAuthzCaller();
    if (!caller) {
      return NextResponse.json(fail("UNAUTHORIZED", "Tidak terautentikasi"), { status: 401 });
    }

    return NextResponse.json(ok(await kpiService.getPendingEntries(caller)));
  } catch (e) {
    return handleError(e);
  }
}
