import { NextResponse } from "next/server";
import { companyRepository } from "@/backend/repositories/company.repository";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { requireAuth } from "@/backend/helpers/get-admin-caller";

export async function GET() {
  try {
    // Daftar PT dipakai luas untuk dropdown lintas modul, jadi cukup butuh sesi valid —
    // sama persis dengan gate middleware yang dulu melindunginya.
    const caller = await requireAuth();
    if (caller instanceof NextResponse) return caller;

    return NextResponse.json(ok(await companyRepository.findAll()));
  } catch (e) {
    return handleError(e);
  }
}
