import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { bankAccountService } from "@/backend/services/bank-account.service";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { withValidation } from "@/backend/middleware/with-validation";
import { authorize } from "@/backend/helpers/authz";

const createAccountSchema = z.object({
  companyId: z.string().min(1),
  bankName: z.string().min(1).max(100),
  accountNumber: z.string().max(50).optional(),
  accountName: z.string().min(1).max(100),
  currencyId: z.string().min(1),
  note: z.string().max(500).optional(),
});

type CreateBody = z.infer<typeof createAccountSchema>;

export async function GET(req: NextRequest) {
  const caller = await authorize("bank.accounts", "view");
  if (caller instanceof NextResponse) return caller;

  try {
    // Non-global callers (caller.companyId set) are locked to their own PT by
    // default; only global roles (Admin/Owner/Akuntan) can omit companyId to
    // see every PT's accounts.
    const requestedCompanyId = req.nextUrl.searchParams.get("companyId") ?? undefined;
    const companyId = requestedCompanyId ?? caller.companyId ?? undefined;
    if (companyId) caller.assertCompany(companyId);
    const onlyActive = req.nextUrl.searchParams.get("active") === "true";
    const accounts = await bankAccountService.getAll(companyId, onlyActive);
    return NextResponse.json(ok(accounts));
  } catch (e) {
    return handleError(e);
  }
}

export const POST = withValidation(createAccountSchema)(
  async (_req: NextRequest, ctx: { body: CreateBody }) => {
    const caller = await authorize("bank.accounts", "write");
    if (caller instanceof NextResponse) return caller;

    try {
      caller.assertCompany(ctx.body.companyId);
      const account = await bankAccountService.create(ctx.body);
      return NextResponse.json(ok(account, "Bank account created"), { status: 201 });
    } catch (e) {
      return handleError(e);
    }
  }
);
