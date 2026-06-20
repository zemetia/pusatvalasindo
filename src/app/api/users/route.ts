import { NextRequest, NextResponse } from "next/server";
import { userService } from "@/backend/services/user.service";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";

export async function GET(req: NextRequest) {
  try {
    const onlyActive = req.nextUrl.searchParams.get("active") === "true";
    const branchId = req.nextUrl.searchParams.get("branchId");
    const users = branchId
      ? await userService.getByBranch(branchId, onlyActive)
      : await userService.getAll(onlyActive);
    return NextResponse.json(ok(users));
  } catch (e) {
    return handleError(e);
  }
}
