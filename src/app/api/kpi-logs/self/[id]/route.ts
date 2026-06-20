import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { can, PERMISSIONS } from "@/lib/permissions";
import { ok, fail } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user) {
      return NextResponse.json(fail("AUTH", "Tidak terautentikasi"), { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { customRole: { select: { permissions: true } } },
    });
    const permissions = user?.customRole?.permissions ?? [];

    if (!can(permissions, PERMISSIONS.KPI_FILL_OWN)) {
      return NextResponse.json(fail("AUTH", "Tidak memiliki izin"), { status: 403 });
    }

    // Only allow deleting the user's own log
    const log = await prisma.kpiLog.findUnique({ where: { id } });
    if (!log) {
      return NextResponse.json(fail("NOT_FOUND", "Log tidak ditemukan"), { status: 404 });
    }
    if (log.employeeId !== session.user.id) {
      return NextResponse.json(fail("AUTH", "Tidak dapat menghapus log milik orang lain"), { status: 403 });
    }

    await prisma.kpiLog.delete({ where: { id } });
    return NextResponse.json(ok(null, "Log dihapus"));
  } catch (e) {
    return handleError(e);
  }
}
