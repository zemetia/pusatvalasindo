import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { bankAccountService } from "@/backend/services/bank-account.service";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { withValidation } from "@/backend/middleware/with-validation";
import { authorize } from "@/backend/helpers/authz";

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
    const caller = await authorize("bank.accounts", "view");
    if (caller instanceof NextResponse) return caller;

    const { id } = await params;
    // Rekening dimiliki 1 PT — pastikan caller non-global hanya bisa mengakses rekening PT-nya
    // sendiri (mencegah IDOR: menebak id rekening PT lain). getById melempar NotFound bila tak ada.
    const account = await bankAccountService.getById(id);
    caller.assertCompany(account.companyId);

    return NextResponse.json(ok(account));
  } catch (e) {
    return handleError(e);
  }
}

export const PUT = withValidation(updateAccountSchema)(
  async (_req: NextRequest, ctx: Params & { body: UpdateBody }) => {
    try {
      const caller = await authorize("bank.accounts", "write");
      if (caller instanceof NextResponse) return caller;

      const { id } = await ctx.params;
      const existing = await bankAccountService.getById(id);
      caller.assertCompany(existing.companyId);

      const account = await bankAccountService.update(id, ctx.body);
      return NextResponse.json(ok(account, "Bank account updated"));
    } catch (e) {
      return handleError(e);
    }
  }
);

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const caller = await authorize("bank.accounts", "write");
    if (caller instanceof NextResponse) return caller;

    const { id } = await params;
    const existing = await bankAccountService.getById(id);
    caller.assertCompany(existing.companyId);

    await bankAccountService.deactivate(id);
    return NextResponse.json(ok(null, "Rekening berhasil dinonaktifkan"));
  } catch (e) {
    return handleError(e);
  }
}
