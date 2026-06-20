import { NextResponse } from "next/server";
import { companyRepository } from "@/backend/repositories/company.repository";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";

export async function GET() {
  try {
    return NextResponse.json(ok(await companyRepository.findAll()));
  } catch (e) {
    return handleError(e);
  }
}
