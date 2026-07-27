import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { priceBenchmarkService } from "@/backend/services/price-benchmark.service";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { withValidation } from "@/backend/middleware/with-validation";
import { requirePermission } from "@/backend/helpers/get-admin-caller";
import { PERMISSIONS } from "@/lib/permissions";

const saveAdjustmentSchema = z.object({
  code: z.string().min(1).max(10),
  sellAdjustment: z.string().max(20),
  buyAdjustment: z.string().max(20),
});

type SaveAdjustmentBody = z.infer<typeof saveAdjustmentSchema>;

export async function GET() {
  const caller = await requirePermission(PERMISSIONS.CURRENCY_VIEW);
  if (caller instanceof NextResponse) return caller;

  try {
    const rows = await priceBenchmarkService.getAll();
    return NextResponse.json(ok(rows));
  } catch (e) {
    return handleError(e);
  }
}

export const PUT = withValidation(saveAdjustmentSchema)(
  async (_req: NextRequest, ctx: { body: SaveAdjustmentBody }) => {
    const caller = await requirePermission(PERMISSIONS.CURRENCY_MANAGE);
    if (caller instanceof NextResponse) return caller;

    try {
      const row = await priceBenchmarkService.saveAdjustment({
        ...ctx.body,
        updatedBy: caller.id,
      });
      return NextResponse.json(ok(row, "Penyesuaian harga disimpan"));
    } catch (e) {
      return handleError(e);
    }
  }
);
