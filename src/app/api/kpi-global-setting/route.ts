import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { kpiService } from "@/backend/services/kpi.service";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { withValidation } from "@/backend/middleware/with-validation";
import { authorize } from "@/backend/helpers/authz";

/**
 * Plafon skor total default berlaku sistem, dipakai bila sebuah jabatan belum
 * punya RoleKpiCap sendiri. `defaultMaxTotalScore` null menghapus plafon
 * default — lihat KpiGlobalSetting di prisma/schema/kpi.prisma.
 */
const setSchema = z.object({
  defaultMaxTotalScore: z.number().positive().nullable(),
});

type SetBody = z.infer<typeof setSchema>;

export async function GET() {
  const caller = await authorize("kpi.config", "view");
  if (caller instanceof NextResponse) return caller;

  try {
    const setting = await kpiService.getGlobalKpiCap();
    return NextResponse.json(ok(setting));
  } catch (e) {
    return handleError(e);
  }
}

export const PUT = withValidation(setSchema)(
  async (_req: NextRequest, ctx: { body: SetBody }) => {
    const caller = await authorize("kpi.config", "write");
    if (caller instanceof NextResponse) return caller;

    try {
      const setting = await kpiService.setGlobalKpiCap(ctx.body.defaultMaxTotalScore);
      return NextResponse.json(
        ok(
          setting,
          ctx.body.defaultMaxTotalScore === null
            ? "Plafon skor total default dihapus"
            : "Plafon skor total default disimpan"
        )
      );
    } catch (e) {
      return handleError(e);
    }
  }
);
