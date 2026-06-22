import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { can, PERMISSIONS } from "@/lib/permissions";
import { ok, fail } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { kpiService } from "@/backend/services/kpi.service";

const createSchema = z.object({
  amount: z.number().positive(),
  note: z.string().max(500).optional(),
});

async function getAuthorizedUser(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, customRole: { select: { permissions: true } } },
  });
  if (!user) return null;

  const permissions = user.customRole?.permissions ?? [];
  if (!can(permissions, PERMISSIONS.KPI_FILL_OWN)) return null;

  return { id: user.id };
}

export async function POST(req: NextRequest) {
  try {
    const caller = await getAuthorizedUser(req);
    if (!caller) {
      return NextResponse.json(fail("AUTH", "Tidak memiliki izin"), { status: 403 });
    }

    const body = createSchema.safeParse(await req.json());
    if (!body.success) {
      return NextResponse.json(
        fail("VALIDATION", body.error.errors[0].message),
        { status: 400 }
      );
    }

    const revenue = await kpiService.createRevenue({
      employeeId: caller.id,
      amount: body.data.amount,
      note: body.data.note,
    });

    return NextResponse.json(ok(revenue, "Target / omset berhasil dicatat"), { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
