import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { authorize } from "@/backend/helpers/authz";
import { isGlobalRole } from "@/lib/permissions";
import { correctionService } from "@/backend/services/correction.service";
import type { CorrectionStatus, CorrectionTargetType } from "@src/generated/prisma/client";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES = ["PENDING", "APPROVED", "REJECTED"];
const TARGETS = ["STOCKIST", "KAS", "BANK"];
const PAGE_SIZE = 50;

// GET /api/koreksi?companyId=&status=&target=&from=&to=&cursor=
// Daftar pengajuan koreksi. Role non-global selalu dipaksa ke PT-nya sendiri, apa pun
// companyId yang dikirim.
export async function GET(req: NextRequest) {
  try {
    const caller = await authorize("correction", "view");
    if (caller instanceof NextResponse) return caller;

    const sp = req.nextUrl.searchParams;
    const requestedCompanyId = sp.get("companyId") ?? undefined;
    const companyId = isGlobalRole(caller.roleName)
      ? requestedCompanyId
      : (caller.companyId ?? "__none__");

    const status = sp.get("status");
    const target = sp.get("target");
    const from = sp.get("from");
    const to = sp.get("to");

    const rows = await correctionService.list(
      {
        companyId,
        status: status && STATUSES.includes(status) ? (status as CorrectionStatus) : undefined,
        target: target && TARGETS.includes(target) ? (target as CorrectionTargetType) : undefined,
        from: from && DATE_RE.test(from) ? new Date(from) : undefined,
        to: to && DATE_RE.test(to) ? new Date(to) : undefined,
      },
      PAGE_SIZE,
      sp.get("cursor") ?? undefined
    );

    const hasMore = rows.length > PAGE_SIZE;
    const items = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

    // CorrectionRequest menyimpan id user (bukan relasi), jadi namanya diresolusi sekali
    // di sini untuk seluruh halaman — bukan per baris.
    const userIds = [
      ...new Set(items.flatMap((r) => [r.requestedBy, r.decidedBy]).filter(Boolean) as string[]),
    ];
    const users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true },
        })
      : [];
    const nameById = new Map(users.map((u) => [u.id, u.name]));

    return NextResponse.json(
      ok({
        items: items.map((r) => ({
          id: r.id,
          companyId: r.companyId,
          companyName: r.company.name,
          target: r.target,
          date: r.date.toISOString().slice(0, 10),
          targetLabel: r.targetLabel,
          currentValue: r.currentValue.toString(),
          proposedValue: r.proposedValue.toString(),
          reason: r.reason,
          status: r.status,
          requestedByName: r.requestedBy ? (nameById.get(r.requestedBy) ?? "—") : "—",
          requestedAt: r.requestedAt.toISOString(),
          decidedByName: r.decidedBy ? (nameById.get(r.decidedBy) ?? "—") : null,
          decidedAt: r.decidedAt?.toISOString() ?? null,
          decisionNote: r.decisionNote,
        })),
        nextCursor: hasMore ? items[items.length - 1].id : null,
        canApprove: caller.can("correction", "write"),
      })
    );
  } catch (e) {
    return handleError(e);
  }
}
