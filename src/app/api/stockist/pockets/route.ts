import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { authorize } from "@/backend/helpers/authz";
import { withValidation } from "@/backend/middleware/with-validation";
import { stockistPocketRepository } from "@/backend/repositories/stockist-pocket.repository";
import { stockistBalanceRepository } from "@/backend/repositories/stockist-balance.repository";

const createPocketSchema = z.object({
  companyId: z.string().min(1),
  name: z.string().min(1).max(100),
  code: z.string().max(20).optional(),
  sortOrder: z.number().int().optional(),
});

type CreateBody = z.infer<typeof createPocketSchema>;

// GET /api/stockist/pockets?companyId=X — list pocket + saldo per currency
export async function GET(req: NextRequest) {
  try {
    const caller = await authorize("stockist.daily", "view");
    if (caller instanceof NextResponse) return caller;

    const companyId = req.nextUrl.searchParams.get("companyId");
    if (!companyId) {
      return NextResponse.json({ error: "companyId wajib diisi" }, { status: 400 });
    }
    caller.assertCompany(companyId);

    const allPockets = await stockistPocketRepository.findAllByCompany(companyId);
    // Pocket "Total" dihitung otomatis (lihat stockist.service.ts) — tidak muncul di sini karena
    // endpoint ini dipakai untuk kelola pocket manual & filter riwayat mutasi.
    const pockets = allPockets.filter((p) => !p.isDefault);
    const balances = pockets.length
      ? await stockistBalanceRepository.findByPocketIds(pockets.map((p) => p.id))
      : [];

    return NextResponse.json(ok({ pockets, balances }));
  } catch (e) {
    return handleError(e);
  }
}

// POST /api/stockist/pockets — buat pocket baru (stockist.manage)
export const POST = withValidation(createPocketSchema)(
  async (_req: NextRequest, ctx: { body: CreateBody }) => {
    try {
      const caller = await authorize("stockist.daily", "write");
      if (caller instanceof NextResponse) return caller;

      caller.assertCompany(ctx.body.companyId);

      const pocket = await stockistPocketRepository.create(ctx.body);
      return NextResponse.json(ok(pocket, "Pocket berhasil dibuat"), { status: 201 });
    } catch (e) {
      return handleError(e);
    }
  }
);
