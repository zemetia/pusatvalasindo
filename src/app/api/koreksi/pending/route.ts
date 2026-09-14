import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { authorize } from "@/backend/helpers/authz";
import { isGlobalRole } from "@/lib/permissions";
import { correctionService } from "@/backend/services/correction.service";

// GET /api/koreksi/pending — jumlah pengajuan koreksi berstatus PENDING, dibatasi
// PT si peninjau (sama seperti GET /api/koreksi), dipakai untuk badge sidebar.
export async function GET(_req: NextRequest) {
  try {
    const caller = await authorize("correction", "view");
    if (caller instanceof NextResponse) return caller;

    const companyId = isGlobalRole(caller.roleName) ? undefined : (caller.companyId ?? "__none__");

    return NextResponse.json(ok(await correctionService.countPending(companyId)));
  } catch (e) {
    return handleError(e);
  }
}
