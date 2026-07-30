import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { kpiService } from "@/backend/services/kpi.service";
import { ok, fail } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { withValidation } from "@/backend/middleware/with-validation";
import { getAuthzCaller } from "@/backend/helpers/authz";

const calculateSchema = z.object({
  employeeId: z.string().min(1),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
});

type CalculateBody = z.infer<typeof calculateSchema>;

export async function GET(req: NextRequest) {
  try {
    const caller = await getAuthzCaller();
    if (!caller) {
      return NextResponse.json(fail("UNAUTHORIZED", "Tidak terautentikasi"), { status: 401 });
    }

    const employeeId = req.nextUrl.searchParams.get("employeeId") ?? caller.id;
    const month = Number(req.nextUrl.searchParams.get("month"));
    const year = Number(req.nextUrl.searchParams.get("year"));

    if (!month || !year) {
      return NextResponse.json(fail("VALIDATION", "month dan year diperlukan"), { status: 400 });
    }

    // Skor sendiri selalu boleh dilihat; skor orang lain butuh scope BACA
    // `kpi.review` yang mencakup PT karyawan itu — gerbang yang sama dengan
    // /api/kpi-entries, jadi keduanya tidak bisa berbeda pendapat.
    await kpiService.assertCanViewEntriesOf(caller, employeeId);

    return NextResponse.json(ok(await kpiService.getMonthlyResult(employeeId, month, year)));
  } catch (e) {
    return handleError(e);
  }
}

export const POST = withValidation(calculateSchema)(
  async (_req: NextRequest, ctx: { body: CalculateBody }) => {
    try {
      // Menghitung ulang skor menulis KPI karyawan lain → scope TULIS, dan
      // scope itu diuji terhadap PT karyawannya, bukan sekadar "punya izin".
      const caller = await getAuthzCaller();
      if (!caller) {
        return NextResponse.json(fail("UNAUTHORIZED", "Tidak terautentikasi"), { status: 401 });
      }

      const { employeeId, month, year } = ctx.body;
      await kpiService.assertCanReview(caller, employeeId);
      const result = await kpiService.calculateMonthlyResult(employeeId, month, year);
      return NextResponse.json(ok(result, "Skor KPI berhasil dihitung ulang"), { status: 201 });
    } catch (e) {
      return handleError(e);
    }
  }
);
