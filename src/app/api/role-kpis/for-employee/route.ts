import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { kpiService } from "@/backend/services/kpi.service";
import { ok, fail } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { getCaller } from "@/backend/helpers/get-admin-caller";
import { getAuthzSubject } from "@/backend/helpers/authz";
import { allows } from "@/lib/authz/resolve";

/**
 * KPI yang berlaku untuk seorang karyawan beserta kebijakan pengisiannya —
 * dipakai form pencatatan agar hanya menampilkan KPI yang memang boleh dicatat
 * oleh si pemanggil.
 */
export async function GET(req: NextRequest) {
  try {
    const caller = await getCaller();
    if (!caller) {
      return NextResponse.json(fail("UNAUTHORIZED", "Tidak terautentikasi"), { status: 401 });
    }

    const employeeId = req.nextUrl.searchParams.get("employeeId") ?? caller.id;

    // KPI orang lain hanya boleh dilihat oleh yang berhak menilai — halaman
    // Penilaian & Persetujuan. KPI sendiri selalu boleh.
    if (employeeId !== caller.id) {
      const subject = await getAuthzSubject();
      if (!subject || !allows(subject, "kpi.review", "view")) {
        return NextResponse.json(
          fail("FORBIDDEN", "Tidak memiliki izin melihat KPI karyawan lain"),
          { status: 403 }
        );
      }
    }

    return NextResponse.json(ok(await kpiService.getRoleKpisForEmployee(employeeId)));
  } catch (e) {
    return handleError(e);
  }
}
