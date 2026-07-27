import { NextRequest, NextResponse } from "next/server";
import { stockMutationService } from "@/backend/services/stock-mutation.service";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { requirePermission } from "@/backend/helpers/get-admin-caller";
import { PERMISSIONS } from "@/lib/permissions";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const caller = await requirePermission(PERMISSIONS.STOCK_VIEW);
    if (caller instanceof NextResponse) return caller;

    const { id } = await params;
    const mutation = await stockMutationService.getById(id);
    return NextResponse.json(ok(mutation));
  } catch (e) {
    return handleError(e);
  }
}
