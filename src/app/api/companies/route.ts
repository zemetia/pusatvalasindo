import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { companyRepository } from "@/backend/repositories/company.repository";
import { companyService } from "@/backend/services/company.service";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { withValidation } from "@/backend/middleware/with-validation";
import { requireAuth } from "@/backend/helpers/get-admin-caller";
import { authorize } from "@/backend/helpers/authz";

const createCompanySchema = z.object({
  name: z.string().min(1).max(120),
  code: z.string().min(1).max(20),
});

type CreateBody = z.infer<typeof createCompanySchema>;

export async function GET() {
  try {
    // Daftar PT dipakai luas untuk dropdown lintas modul, jadi cukup butuh sesi valid —
    // sama persis dengan gate middleware yang dulu melindunginya. Yang digerbangi
    // resource `companies` adalah perubahannya (POST/PUT/DELETE), bukan pembacaannya.
    const caller = await requireAuth();
    if (caller instanceof NextResponse) return caller;

    return NextResponse.json(ok(await companyRepository.findAll()));
  } catch (e) {
    return handleError(e);
  }
}

export const POST = withValidation(createCompanySchema)(
  async (_req: NextRequest, ctx: { body: CreateBody }) => {
    const authz = await authorize("companies", "write");
    if (authz instanceof NextResponse) return authz;

    try {
      const company = await companyService.create(ctx.body);
      return NextResponse.json(ok(company, "PT ditambahkan"), { status: 201 });
    } catch (e) {
      return handleError(e);
    }
  }
);
