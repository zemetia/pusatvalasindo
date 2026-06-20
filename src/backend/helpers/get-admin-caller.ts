import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

const ALLOWED_ROLES = ["SUPER_ADMIN", "OWNER", "KEPALA_CABANG"];

export type AdminCaller = {
  id: string;
  companyId: string | null;
  roleName: string;
};

/**
 * Validates session and role in a single reusable call.
 * Returns AdminCaller on success, or a NextResponse (401/403) on failure.
 * Usage: const caller = await getAdminCaller(); if (caller instanceof NextResponse) return caller;
 */
export async function getAdminCaller(): Promise<AdminCaller | NextResponse> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  const caller = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { companyId: true, customRole: { select: { name: true } } },
  });

  const roleName = caller?.customRole?.name?.toUpperCase();
  if (!roleName || !ALLOWED_ROLES.includes(roleName)) {
    return NextResponse.json({ error: "Tidak memiliki izin" }, { status: 403 });
  }

  return { id: session.user.id, companyId: caller?.companyId ?? null, roleName };
}
