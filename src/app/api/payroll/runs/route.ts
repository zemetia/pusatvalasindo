// Perhitungan gaji satu PT untuk satu bulan, beserta hasilnya yang tersimpan.
//
//   GET  ?companyId&month&year  — run terbaru periode itu (null kalau belum ada)
//   POST { companyId, month, year } — hitung ulang, membuat run baru
//
// Wewenangnya `payroll.manage` di PT yang bersangkutan. Berbeda dari
// /api/payroll/calculate yang boleh dipakai karyawan untuk melihat gajinya
// sendiri, run menyentuh seluruh karyawan satu PT — jadi tidak ada jalur
// `payroll.self` di sini.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { payrollRunService } from "@/backend/services/payroll-run.service";
import { ok, fail } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { withValidation } from "@/backend/middleware/with-validation";
import { requireAuth } from "@/backend/helpers/get-admin-caller";
import { getAuthzSubject } from "@/backend/helpers/authz";
import { allowsCompany } from "@/lib/authz/resolve";
import { serializeRun } from "./serialize";

const generateSchema = z.object({
  companyId: z.string().min(1),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
});

type GenerateBody = z.infer<typeof generateSchema>;

async function guard(companyId: string, action: "view" | "write") {
  const caller = await requireAuth();
  if (caller instanceof NextResponse) return { response: caller };
  const subject = await getAuthzSubject();
  if (!subject) {
    return {
      response: NextResponse.json(fail("UNAUTHORIZED", "Tidak terautentikasi"), { status: 401 }),
    };
  }
  if (!allowsCompany(subject, "payroll.manage", action, companyId)) {
    return {
      response: NextResponse.json(fail("FORBIDDEN", "Tidak punya akses ke gaji PT ini"), {
        status: 403,
      }),
    };
  }
  return { callerId: caller.id };
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const companyId = url.searchParams.get("companyId") ?? "";
    const month = Number(url.searchParams.get("month"));
    const year = Number(url.searchParams.get("year"));

    if (!companyId || !Number.isInteger(month) || !Number.isInteger(year)) {
      return NextResponse.json(fail("VALIDATION_ERROR", "companyId, month, dan year wajib diisi"), {
        status: 400,
      });
    }

    const g = await guard(companyId, "view");
    if (g.response) return g.response;

    const [run, attempts] = await Promise.all([
      payrollRunService.getRun(companyId, month, year),
      payrollRunService.listAttempts(companyId, month, year),
    ]);

    return NextResponse.json(
      ok({
        run: run ? serializeRun(run) : null,
        attempts: attempts.map((a) => ({
          id: a.id,
          attempt: a.attempt,
          status: a.status,
          generatedAt: a.generatedAt.toISOString(),
          paidAt: a.paidAt?.toISOString() ?? null,
          jumlahSlip: a._count.slips,
        })),
      })
    );
  } catch (e) {
    return handleError(e);
  }
}

export const POST = withValidation(generateSchema)(
  async (_req: NextRequest, ctx: { body: GenerateBody }) => {
    try {
      const { companyId, month, year } = ctx.body;

      const g = await guard(companyId, "write");
      if (g.response) return g.response;

      await payrollRunService.generateRun({
        companyId,
        month,
        year,
        generatedById: g.callerId ?? null,
      });

      // Sengaja membaca ulang lewat getRun, bukan memakai kembalian create:
      // bentuk yang dipakai halaman selalu satu, dan tidak ada kemungkinan
      // dua bentuk berbeda menyimpang diam-diam.
      const run = await payrollRunService.getRun(companyId, month, year);

      return NextResponse.json(
        ok({ run: run ? serializeRun(run) : null }, "Gaji bulan ini berhasil dihitung"),
        { status: 201 }
      );
    } catch (e) {
      return handleError(e);
    }
  }
);
