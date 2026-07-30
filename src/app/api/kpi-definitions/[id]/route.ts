import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { kpiService } from "@/backend/services/kpi.service";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { withValidation } from "@/backend/middleware/with-validation";
import { authorize } from "@/backend/helpers/authz";
import { kpiDefinitionSchema } from "../route";

const updateSchema = kpiDefinitionSchema.partial();

type Params = { params: Promise<{ id: string }> };
type UpdateBody = ReturnType<typeof updateSchema.parse>;

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const caller = await authorize("kpi.definitions", "view");
    if (caller instanceof NextResponse) return caller;

    const { id } = await params;
    return NextResponse.json(ok(await kpiService.getDefinitionById(id)));
  } catch (e) {
    return handleError(e);
  }
}

export const PUT = withValidation(updateSchema)(
  async (_req: NextRequest, ctx: Params & { body: UpdateBody }) => {
    try {
      const caller = await authorize("kpi.definitions", "write");
      if (caller instanceof NextResponse) return caller;

      const { id } = await ctx.params;
      const updated = await kpiService.updateDefinition(id, ctx.body);
      return NextResponse.json(ok(updated, "Definisi KPI berhasil diperbarui"));
    } catch (e) {
      return handleError(e);
    }
  }
);

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const caller = await authorize("kpi.definitions", "write");
    if (caller instanceof NextResponse) return caller;

    const { id } = await params;
    await kpiService.deleteDefinition(id);
    return NextResponse.json(ok(null, "Definisi KPI berhasil dihapus"));
  } catch (e) {
    return handleError(e);
  }
}
