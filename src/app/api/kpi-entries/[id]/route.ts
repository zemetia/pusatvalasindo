import { NextRequest, NextResponse } from "next/server";
import { kpiService } from "@/backend/services/kpi.service";
import { ok, fail } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { getCaller } from "@/backend/helpers/get-admin-caller";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const caller = await getCaller();
    if (!caller) {
      return NextResponse.json(fail("UNAUTHORIZED", "Tidak terautentikasi"), { status: 401 });
    }

    const { id } = await params;
    // Siapa boleh menghapus entri siapa ditegakkan di service.
    await kpiService.deleteEntry(caller, id);
    return NextResponse.json(ok(null, "Entri KPI dihapus"));
  } catch (e) {
    return handleError(e);
  }
}
