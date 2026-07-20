import { NextRequest, NextResponse } from "next/server";
import { userService } from "@/backend/services/user.service";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { requirePermission } from "@/backend/helpers/get-admin-caller";
import { PERMISSIONS } from "@/lib/permissions";
import { ForbiddenError } from "@/backend/errors/app-error";

export async function GET(req: NextRequest) {
  const caller = await requirePermission(PERMISSIONS.USERS_VIEW);
  if (caller instanceof NextResponse) return caller;

  try {
    const onlyActive = req.nextUrl.searchParams.get("active") === "true";
    const requestedBranchId = req.nextUrl.searchParams.get("branchId");

    // Branch/company-scoped callers can't widen their view via the query
    // string — only globally-scoped roles (no branchId/companyId on their
    // own user record) may request any branch or omit the filter entirely.
    if (caller.branchId) {
      if (requestedBranchId && requestedBranchId !== caller.branchId) {
        throw new ForbiddenError("Tidak punya akses ke cabang lain");
      }
      const users = await userService.getByBranch(caller.branchId, onlyActive);
      return NextResponse.json(ok(users));
    }

    if (requestedBranchId) {
      const users = await userService.getByBranch(requestedBranchId, onlyActive);
      return NextResponse.json(ok(users));
    }

    if (caller.companyId) {
      const users = await userService.getByCompany(caller.companyId, onlyActive);
      return NextResponse.json(ok(users));
    }

    const users = await userService.getAll(onlyActive);
    return NextResponse.json(ok(users));
  } catch (e) {
    return handleError(e);
  }
}
