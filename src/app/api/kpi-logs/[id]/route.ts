import { NextRequest, NextResponse } from "next/server";
import { kpiService } from "@/backend/services/kpi.service";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    await kpiService.deleteLog(id);
    return NextResponse.json(ok(null, "Log KPI berhasil dihapus"));
  } catch (e) {
    return handleError(e);
  }
}
