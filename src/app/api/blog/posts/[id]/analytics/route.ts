import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { authorize } from "@/backend/helpers/authz";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { blogService } from "@/backend/services/blog.service";
import { parseRangeDays } from "@/lib/blog/analytics-range";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const authz = await authorize("blog", "view");
  if (authz instanceof NextResponse) return authz;

  try {
    const { id } = await params;
    const days = parseRangeDays(req.nextUrl.searchParams.get("days"));
    return NextResponse.json(ok(await blogService.getPostAnalytics(id, days)));
  } catch (e) {
    return handleError(e);
  }
}
