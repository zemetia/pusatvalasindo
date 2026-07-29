import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { kpiCollectorService } from "@/backend/services/kpi-collector.service";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { withValidation } from "@/backend/middleware/with-validation";
import { requirePermission } from "@/backend/helpers/get-admin-caller";
import { assertCompanyAccess } from "@/backend/services/stockist.service";
import { PERMISSIONS } from "@/lib/permissions";

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
      const caller = await requirePermission(PERMISSIONS.KPI_VIEW_ALL);
      if (caller instanceof NextResponse) return caller;

      const { employeeId, month, year } = ctx.body;

      if (employeeId) {
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

      // Pemanggil yang terikat satu PT hanya boleh menarik karyawan PT-nya.
      const companyId = caller.companyId;
      if (companyId) assertCompanyAccess(caller, companyId);

      const results = await kpiCollectorService.collectForPeriod(month, year, { companyId });
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
