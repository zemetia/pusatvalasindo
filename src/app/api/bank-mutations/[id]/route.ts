import { NextRequest, NextResponse } from "next/server";
import { bankMutationService } from "@/backend/services/bank-mutation.service";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const mutation = await bankMutationService.getById(id);
    return NextResponse.json(ok(mutation));
  } catch (e) {
    return handleError(e);
  }
}
