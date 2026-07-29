import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { kpiService } from "@/backend/services/kpi.service";
import { ok, fail } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { withValidation } from "@/backend/middleware/with-validation";
import { getCaller } from "@/backend/helpers/get-admin-caller";

/**
 * Mengunci / membuka periode penilaian seorang karyawan. Mengunci sekaligus
 * menghitung ulang skornya, supaya angka yang dibekukan konsisten dengan entri
 * yang ada saat itu.
 */
const schema = z.object({
  employeeId: z.string().min(1),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
  action: z.enum(["LOCK", "UNLOCK"]),
});

type Body = z.infer<typeof schema>;

export const POST = withValidation(schema)(
  async (_req: NextRequest, ctx: { body: Body }) => {
    try {
      const caller = await getCaller();
      if (!caller) {
        return NextResponse.json(fail("UNAUTHORIZED", "Tidak terautentikasi"), { status: 401 });
      }

      const { employeeId, month, year, action } = ctx.body;
      const period =
        action === "LOCK"
          ? await kpiService.lockPeriod(caller, employeeId, month, year)
          : await kpiService.unlockPeriod(caller, employeeId, month, year);

      return NextResponse.json(
        ok(period, action === "LOCK" ? "Periode dikunci" : "Periode dibuka kembali")
      );
    } catch (e) {
      return handleError(e);
    }
  }
);
