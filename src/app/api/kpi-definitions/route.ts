import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { KpiType } from "@src/generated/prisma/client";
import { kpiService } from "@/backend/services/kpi.service";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { withValidation } from "@/backend/middleware/with-validation";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.nativeEnum(KpiType),
});

type CreateBody = z.infer<typeof createSchema>;

export async function GET() {
  try {
    return NextResponse.json(ok(await kpiService.getAllDefinitions()));
  } catch (e) {
    return handleError(e);
  }
}

export const POST = withValidation(createSchema)(
  async (_req: NextRequest, ctx: { body: CreateBody }) => {
    try {
      const definition = await kpiService.createDefinition(ctx.body);
      return NextResponse.json(
        ok(definition, "Definisi KPI berhasil ditambahkan"),
        { status: 201 }
      );
    } catch (e) {
      return handleError(e);
    }
  }
);
