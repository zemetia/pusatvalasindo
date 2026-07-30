import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userService } from "@/backend/services/user.service";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { authorize } from "@/backend/helpers/authz";
import { ForbiddenError, NotFoundError } from "@/backend/errors/app-error";

export async function GET(req: NextRequest) {
  const authz = await authorize("users", "view");
  if (authz instanceof NextResponse) return authz;

  try {
    const onlyActive = req.nextUrl.searchParams.get("active") === "true";
    const requestedBranchId = req.nextUrl.searchParams.get("branchId");

    // Filter cabang lewat query string tidak boleh dipakai untuk melebarkan
    // jangkauan: cabang yang diminta harus berada di dalam scope PT si
    // pemanggil. Tanpa parameter ini, daftarnya sudah otomatis tersaring scope.
    if (requestedBranchId) {
      const branch = await prisma.branch.findUnique({
        where: { id: requestedBranchId },
        select: { companyId: true },
      });
      if (!branch) throw new NotFoundError("Cabang tidak ditemukan");
      if (!authz.canView(branch.companyId)) {
        throw new ForbiddenError("Tidak punya akses ke cabang ini");
      }
    }

    const users = await userService.getScoped({
      companyIds: authz.companyIds,
      branchId: requestedBranchId,
      onlyActive,
    });
    return NextResponse.json(ok(users));
  } catch (e) {
    return handleError(e);
  }
}
