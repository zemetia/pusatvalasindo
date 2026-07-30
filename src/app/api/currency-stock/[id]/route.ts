import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { currencyStockService, assertBranchAccess } from "@/backend/services/currency-stock.service";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { withValidation } from "@/backend/middleware/with-validation";
import { authorize, type Authz } from "@/backend/helpers/authz";

const updateRatesSchema = z.object({
  buyRate: z.number().positive().optional(),
  sellRate: z.number().positive().optional(),
});

type Params = { params: Promise<{ id: string }> };
type UpdateBody = z.infer<typeof updateRatesSchema>;

/**
 * Stok melekat pada cabang, jadi cabang & PT-nya ikut diuji — bukan cuma "punya
 * izin mata uang". Barisnya bisa kehilangan cabang (`onDelete: SetNull`); yang
 * yatim begitu tidak dimiliki PT mana pun, jadi hanya pemegang scope seluruh PT
 * yang boleh menyentuhnya (`assertCompany(null)` menolak selain itu).
 */
async function assertStockScope(authz: Authz, branchId: string | null) {
  if (branchId) {
    await assertBranchAccess(authz, branchId);
    return;
  }
  authz.assertCompany(null);
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const authz = await authorize("currency.stock", "view");
    if (authz instanceof NextResponse) return authz;

    const { id } = await params;
    const stock = await currencyStockService.getById(id);
    await assertStockScope(authz, stock.branchId);
    return NextResponse.json(ok(stock));
  } catch (e) {
    return handleError(e);
  }
}

export const PUT = withValidation(updateRatesSchema)(
  async (_req: NextRequest, ctx: Params & { body: UpdateBody }) => {
    try {
      const authz = await authorize("currency.stock", "write");
      if (authz instanceof NextResponse) return authz;

      const { id } = await ctx.params;
      // Diuji terhadap scope TULIS: jabatan yang boleh memantau kurs beberapa PT
      // belum tentu boleh mengubahnya di semua PT itu.
      const stock = await currencyStockService.getById(id);
      await assertStockScope(authz, stock.branchId);

      const updated = await currencyStockService.updateRates(
        id,
        ctx.body.buyRate,
        ctx.body.sellRate
      );
      return NextResponse.json(ok(updated, "Rates updated"));
    } catch (e) {
      return handleError(e);
    }
  }
);
