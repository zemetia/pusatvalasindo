import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { stockMutationService } from "@/backend/services/stock-mutation.service";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { withValidation } from "@/backend/middleware/with-validation";
import { StockMutationType } from "@src/generated/prisma/client";
import { requirePermission } from "@/backend/helpers/get-admin-caller";
import { PERMISSIONS } from "@/lib/permissions";

const createMutationSchema = z.object({
  branchId: z.string().min(1),
  currencyId: z.string().min(1),
  type: z.nativeEnum(StockMutationType),
  quantity: z.number().positive(),
  rate: z.number().positive().optional(),
  note: z.string().max(500).optional(),
});

type CreateBody = z.infer<typeof createMutationSchema>;

export async function GET(req: NextRequest) {
  try {
    const caller = await requirePermission(PERMISSIONS.STOCK_VIEW);
    if (caller instanceof NextResponse) return caller;

    const { searchParams } = req.nextUrl;
    const filters = {
      branchId: searchParams.get("branchId") ?? undefined,
      currencyId: searchParams.get("currencyId") ?? undefined,
      type: searchParams.get("type") ?? undefined,
      from: searchParams.get("from") ? new Date(searchParams.get("from")!) : undefined,
      to: searchParams.get("to") ? new Date(searchParams.get("to")!) : undefined,
    };
    const mutations = await stockMutationService.getAll(filters);
    return NextResponse.json(ok(mutations));
  } catch (e) {
    return handleError(e);
  }
}

export const POST = withValidation(createMutationSchema)(
  async (_req: NextRequest, ctx: { body: CreateBody }) => {
    try {
      const caller = await requirePermission(PERMISSIONS.STOCK_MANAGE);
      if (caller instanceof NextResponse) return caller;

      const mutation = await stockMutationService.create(ctx.body);
      return NextResponse.json(ok(mutation, "Mutation created"), { status: 201 });
    } catch (e) {
      return handleError(e);
    }
  }
);
