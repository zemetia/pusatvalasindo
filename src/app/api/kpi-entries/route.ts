import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { kpiService } from "@/backend/services/kpi.service";
import { ok, fail } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { withValidation } from "@/backend/middleware/with-validation";
import { getAuthzCaller } from "@/backend/helpers/authz";

/**
 * Entri KPI harian — menggantikan /api/kpi-logs dan /api/revenues sekaligus.
 *
 * Tidak ada route `self` terpisah: siapa boleh mencatat apa ditentukan
 * kpiService.createEntry dari kebijakan tiap KPI (SELF/SUPERVISOR/SYSTEM),
 * bukan dari URL mana yang dipanggil.
 */

const createSchema = z.object({
  employeeId: z.string().min(1),
  roleKpiId: z.string().min(1),
  /** Tanggal kejadian, bukan tanggal input. */
  occurredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "format tanggal harus YYYY-MM-DD"),
  quantity: z.number().finite(),
  note: z.string().max(500).nullish(),
  evidenceUrl: z.string().url().max(500).nullish(),
});

type CreateBody = z.infer<typeof createSchema>;

/**
 * "YYYY-MM-DD" → tengah malam UTC.
 *
 * Kolom `occurredAt` bertipe `@db.Date` dan seluruh modul memperlakukannya di
 * UTC (lihat src/lib/finance-period.ts). Memakai tengah malam *lokal* di zona
 * WIB (UTC+7) membuat tanggal 1 Juli tersimpan sebagai 30 Juni — entri masuk ke
 * bulan yang salah dan hilang dari periode penilaiannya.
 */
function parseDateKey(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

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

    // Entri sendiri cukup sesi; entri orang lain butuh scope BACA `kpi.review`
    // yang mencakup PT karyawan itu. Aturannya di service — PT-nya harus dibaca
    // dulu, dan /api/kpi-monthly-results memakai gerbang yang sama.
    await kpiService.assertCanViewEntriesOf(caller, employeeId);

    const [entries, period] = await Promise.all([
      kpiService.getEntriesByEmployeePeriod(employeeId, year, month),
      kpiService.getPeriod(employeeId, month, year),
    ]);

    return NextResponse.json(ok({ entries, period }));
  } catch (e) {
    return handleError(e);
  }
}

export const POST = withValidation(createSchema)(
  async (_req: NextRequest, ctx: { body: CreateBody }) => {
    try {
      const caller = await getAuthzCaller();
      if (!caller) {
        return NextResponse.json(fail("UNAUTHORIZED", "Tidak terautentikasi"), { status: 401 });
      }

      const entry = await kpiService.createEntry(caller, {
        employeeId: ctx.body.employeeId,
        roleKpiId: ctx.body.roleKpiId,
        occurredAt: parseDateKey(ctx.body.occurredAt),
        quantity: ctx.body.quantity,
        note: ctx.body.note,
        evidenceUrl: ctx.body.evidenceUrl,
      });

      return NextResponse.json(
        ok(
          entry,
          entry.status === "PENDING"
            ? "Tercatat, menunggu persetujuan atasan"
            : "KPI berhasil dicatat"
        ),
        { status: 201 }
      );
    } catch (e) {
      return handleError(e);
    }
  }
);
