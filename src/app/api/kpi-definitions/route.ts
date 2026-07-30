import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { kpiService } from "@/backend/services/kpi.service";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { withValidation } from "@/backend/middleware/with-validation";
import { authorize } from "@/backend/helpers/authz";

export const kpiDefinitionSchema = z.object({
  code: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "hanya boleh huruf kecil, angka, dan tanda hubung"),
  name: z.string().min(1).max(120),
  objective: z.string().max(300).nullish(),
  description: z.string().max(1000).nullish(),
  scoringType: z.enum([
    "TARGET_VALUE",
    "PENALTY_POINT",
    "REWARD_POINT",
    "PENALTY_PERCENT",
    "TOLERANCE_LIMIT",
    "BOOLEAN_DAILY",
  ]),
  unit: z.enum(["OCCURRENCE", "CURRENCY", "POINT", "PERCENT", "DAY", "PERSON"]).optional(),
  direction: z.enum(["HIGHER_BETTER", "LOWER_BETTER"]).optional(),
  defaultInputSource: z.enum(["SELF", "SUPERVISOR", "SYSTEM"]).optional(),
  defaultRequiresApproval: z.boolean().optional(),
  defaultRequiresEvidence: z.boolean().optional(),
  systemSourceKey: z.string().max(60).nullish(),
  isActive: z.boolean().optional(),
});

type CreateBody = z.infer<typeof kpiDefinitionSchema>;

export async function GET(req: NextRequest) {
  try {
    const caller = await authorize("kpi.definitions", "view");
    if (caller instanceof NextResponse) return caller;

    const activeOnly = req.nextUrl.searchParams.get("activeOnly") === "true";
    const definitions = activeOnly
      ? await kpiService.getActiveDefinitions()
      : await kpiService.getAllDefinitions();

    return NextResponse.json(ok(definitions));
  } catch (e) {
    return handleError(e);
  }
}

export const POST = withValidation(kpiDefinitionSchema)(
  async (_req: NextRequest, ctx: { body: CreateBody }) => {
    try {
      const caller = await authorize("kpi.definitions", "write");
      if (caller instanceof NextResponse) return caller;

      const definition = await kpiService.createDefinition(ctx.body);
      return NextResponse.json(ok(definition, "Definisi KPI berhasil ditambahkan"), {
        status: 201,
      });
    } catch (e) {
      return handleError(e);
    }
  }
);
