import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { bankAccountService } from "@/backend/services/bank-account.service";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { withValidation } from "@/backend/middleware/with-validation";

const updateAccountSchema = z.object({
  bankName: z.string().min(1).max(100).optional(),
  accountNumber: z.string().min(1).max(50).optional(),
  accountName: z.string().min(1).max(100).optional(),
  note: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
});

type Params = { params: Promise<{ id: string }> };
type UpdateBody = z.infer<typeof updateAccountSchema>;

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const account = await bankAccountService.getById(id);
    return NextResponse.json(ok(account));
  } catch (e) {
    return handleError(e);
  }
}

export const PUT = withValidation(updateAccountSchema)(
  async (_req: NextRequest, ctx: Params & { body: UpdateBody }) => {
    try {
      const { id } = await ctx.params;
      const account = await bankAccountService.update(id, ctx.body);
      return NextResponse.json(ok(account, "Bank account updated"));
    } catch (e) {
      return handleError(e);
    }
  }
);

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    await bankAccountService.deactivate(id);
    return NextResponse.json(ok(null, "Rekening berhasil dinonaktifkan"));
  } catch (e) {
    return handleError(e);
  }
}
