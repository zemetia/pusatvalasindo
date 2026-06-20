import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { branchService } from "@/backend/services/branch.service";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { withValidation } from "@/backend/middleware/with-validation";

const createBranchSchema = z.object({
  name: z.string().min(1).max(100),
  address: z.string().max(500).optional(),
  phone: z.string().max(20).optional(),
  companyId: z.string().cuid().optional().nullable(),
});

type CreateBody = z.infer<typeof createBranchSchema>;

export async function GET(req: NextRequest) {
  try {
    const onlyActive = req.nextUrl.searchParams.get("active") === "true";
    const branches = await branchService.getAll(onlyActive);
    return NextResponse.json(ok(branches));
  } catch (e) {
    return handleError(e);
  }
}

export const POST = withValidation(createBranchSchema)(
  async (_req: NextRequest, ctx: { body: CreateBody }) => {
    try {
      const branch = await branchService.create(ctx.body);
      return NextResponse.json(ok(branch, "Branch created"), { status: 201 });
    } catch (e) {
      return handleError(e);
    }
  }
);
