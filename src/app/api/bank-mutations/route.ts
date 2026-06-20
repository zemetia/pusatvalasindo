import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { bankMutationService } from "@/backend/services/bank-mutation.service";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { withValidation } from "@/backend/middleware/with-validation";
import { BankMutationType } from "@src/generated/prisma/client";

const createMutationSchema = z.object({
  bankAccountId: z.string().min(1),
  type: z.nativeEnum(BankMutationType),
  amount: z.number().positive(),
  description: z.string().max(500).optional(),
});

type CreateBody = z.infer<typeof createMutationSchema>;

export async function GET(req: NextRequest) {
  try {
    const bankAccountId = req.nextUrl.searchParams.get("bankAccountId");
    if (!bankAccountId) {
      return NextResponse.json({ success: false, error: "bankAccountId is required" }, { status: 400 });
    }
    const mutations = await bankMutationService.getByAccount(bankAccountId);
    return NextResponse.json(ok(mutations));
  } catch (e) {
    return handleError(e);
  }
}

export const POST = withValidation(createMutationSchema)(
  async (_req: NextRequest, ctx: { body: CreateBody }) => {
    try {
      const mutation = await bankMutationService.create(ctx.body);
      return NextResponse.json(ok(mutation, "Mutation created"), { status: 201 });
    } catch (e) {
      return handleError(e);
    }
  }
);
