import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { kpiCollectorService } from "@/backend/services/kpi-collector.service";
import { ok, fail } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { withValidation } from "@/backend/middleware/with-validation";
import { getAuthzCaller } from "@/backend/helpers/authz";
import { kpiService } from "@/backend/services/kpi.service";

/**
 * Tarik ulang KPI yang bersumber dari modul lain (absensi) menjadi entri KPI.
 *
 * Tanpa `employeeId`, seluruh karyawan aktif dalam cakupan PT si pemanggil
 * ikut ditarik — bentuk yang dipakai saat tutup bulan atau oleh penjadwal.
 *
 * Aman diulang: entri hasil sistem untuk periode itu selalu ditulis ulang,
 * bukan ditambahkan.
 */
const schema = z.object({
  employeeId: z.string().min(1).optional(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
});

type Body = z.infer<typeof schema>;

export const POST = withValidation(schema)(
  async (_req: NextRequest, ctx: { body: Body }) => {
    try {
      // Menarik ulang entri = menulis data KPI orang lain, jadi gerbangnya
      // scope TULIS `kpi.review`, bukan sekadar "boleh melihat KPI semua orang".
      const caller = await getAuthzCaller();
      if (!caller) {
        return NextResponse.json(fail("UNAUTHORIZED", "Tidak terautentikasi"), { status: 401 });
      }

      const { employeeId, month, year } = ctx.body;

      if (employeeId) {
        await kpiService.assertCanReview(caller, employeeId);
        const result = await kpiCollectorService.collectForEmployee(employeeId, month, year);
        const total = result.collected.reduce((sum, c) => sum + c.entryCount, 0);
        return NextResponse.json(
          ok(
            result,
            result.locked
              ? "Periode sudah dikunci — tidak ada data yang diubah"
              : `${total} catatan ditarik dari absensi`
          )
        );
      }

      // Yang ditarik adalah karyawan PT-PT dalam scope TULIS si pemanggil —
      // bukan PT-nya sendiri. Dengan begitu jabatan yang diberi wewenang atas
      // PT A dan PT B menarik keduanya, dan yang hanya PT A tidak menyentuh B.
      // `null` berarti seluruh PT (Owner/Super Admin).
      const companyIds = kpiService.reviewableCompanyIds(caller);

      const results = await kpiCollectorService.collectForPeriod(month, year, { companyIds });
      const totalEntries = results.reduce(
        (sum, r) => sum + r.collected.reduce((s, c) => s + c.entryCount, 0),
        0
      );
      const lockedCount = results.filter((r) => r.locked).length;

      return NextResponse.json(
        ok(
          { employeeCount: results.length, totalEntries, lockedCount, results },
          `${totalEntries} catatan ditarik untuk ${results.length} karyawan` +
            (lockedCount > 0 ? ` (${lockedCount} periode terkunci, dilewati)` : "")
        )
      );
    } catch (e) {
      return handleError(e);
    }
  }
);
