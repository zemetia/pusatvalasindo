import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { priceBenchmarkService } from "@/backend/services/price-benchmark.service";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { withValidation } from "@/backend/middleware/with-validation";
import { authorize } from "@/backend/helpers/authz";

const saveAdjustmentSchema = z.object({
  code: z.string().min(1).max(10),
  sellAdjustment: z.string().max(20),
  buyAdjustment: z.string().max(20),
});

type SaveAdjustmentBody = z.infer<typeof saveAdjustmentSchema>;

export async function GET() {
  const caller = await authorize("price.benchmark", "view");
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
    const caller = await authorize("price.benchmark", "write");
    if (caller instanceof NextResponse) return caller;

    try {
      const row = await priceBenchmarkService.saveAdjustment({
        ...ctx.body,
        updatedBy: caller.userId,
      });
      return NextResponse.json(ok(row, "Penyesuaian harga disimpan"));
    } catch (e) {
      return handleError(e);
    }
  }
);
