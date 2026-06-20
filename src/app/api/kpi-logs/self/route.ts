import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { can, PERMISSIONS } from "@/lib/permissions";
import { ok, fail } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { kpiService } from "@/backend/services/kpi.service";

const createSchema = z.object({
  kpiId: z.string().min(1),
  value: z.number().positive(),
  note: z.string().max(500).optional(),
});

async function getAuthorizedUser(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      customRole: { select: { permissions: true } },
    },
  });
  if (!user) return null;

  const permissions = user.customRole?.permissions ?? [];
  if (!can(permissions, PERMISSIONS.KPI_FILL_OWN)) return null;

  return { id: user.id, permissions };
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

    // Verify the kpiId is mapped to the user's role
    const user = await prisma.user.findUnique({
      where: { id: caller.id },
      select: { customRole: { select: { id: true } } },
    });
    const customRoleId = user?.customRole?.id;

    if (customRoleId) {
      const roleKpi = await prisma.roleKpi.findFirst({
        where: { kpiId: body.data.kpiId, customRoleId },
      });
      if (!roleKpi) {
        return NextResponse.json(
          fail("VALIDATION", "KPI ini tidak terdaftar untuk jabatan Anda"),
          { status: 400 }
        );
      }
    }

    const log = await kpiService.createLog({
      employeeId: caller.id,
      kpiId: body.data.kpiId,
      value: body.data.value,
      note: body.data.note,
    });

    return NextResponse.json(ok(log, "KPI berhasil dicatat"), { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
