import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { kpiService } from "@/backend/services/kpi.service";
import { ok, fail } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { withValidation } from "@/backend/middleware/with-validation";
import { getCaller } from "@/backend/helpers/get-admin-caller";

const reviewSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  reviewNote: z.string().max(500).optional(),
});

type Params = { params: Promise<{ id: string }> };
type ReviewBody = z.infer<typeof reviewSchema>;

export const POST = withValidation(reviewSchema)(
  async (_req: NextRequest, ctx: Params & { body: ReviewBody }) => {
    try {
      const caller = await getCaller();
      if (!caller) {
        return NextResponse.json(fail("UNAUTHORIZED", "Tidak terautentikasi"), { status: 401 });
      }

      const { id } = await ctx.params;
      const entry = await kpiService.reviewEntry(
        caller,
        id,
        ctx.body.decision,
        ctx.body.reviewNote
      );

      return NextResponse.json(
        ok(entry, ctx.body.decision === "APPROVED" ? "Entri disetujui" : "Entri ditolak")
      );
    } catch (e) {
      return handleError(e);
    }
  }
);
