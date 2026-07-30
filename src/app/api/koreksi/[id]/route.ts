import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { authorize } from "@/backend/helpers/authz";
import { isGlobalRole } from "@/lib/permissions";
import { ForbiddenError } from "@/backend/errors/app-error";
import { correctionService } from "@/backend/services/correction.service";

const decisionSchema = z.object({
  action: z.enum(["APPROVE", "REJECT"]),
  decisionNote: z.string().max(500).optional(),
});

// PATCH /api/koreksi/[id] — setujui / tolak pengajuan koreksi.
// Digerbangi permission correction.approve DAN role global: keputusannya mengubah saldo,
// jadi sengaja dibatasi ke Owner & Super Admin saja meski permission-nya bocor ke role lain.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const caller = await authorize("correction", "write");
    if (caller instanceof NextResponse) return caller;
    if (!isGlobalRole(caller.roleName)) {
      throw new ForbiddenError("Hanya Owner / Super Admin yang bisa menyetujui koreksi");
    }

    const parsed = decisionSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Payload tidak valid" }, { status: 400 });
    }

    const { id } = await ctx.params;
    const result =
      parsed.data.action === "APPROVE"
        ? await correctionService.approve(id, caller.userId, parsed.data.decisionNote)
        : await correctionService.reject(id, caller.userId, parsed.data.decisionNote);

    return NextResponse.json(
      ok(
        { id: result.id, status: result.status },
        parsed.data.action === "APPROVE" ? "Koreksi disetujui & diterapkan" : "Koreksi ditolak"
      )
    );
  } catch (e) {
    return handleError(e);
  }
}
