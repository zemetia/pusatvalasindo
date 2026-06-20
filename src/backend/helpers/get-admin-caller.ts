import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { can, Permission } from "@/lib/permissions";

const ADMIN_ROLES = ["SUPER_ADMIN", "OWNER", "KEPALA_CABANG"];

export type AdminCaller = {
  id: string;
  companyId: string | null;
  roleName: string;
  permissions: string[];
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
    select: {
      companyId: true,
      customRole: { select: { name: true, permissions: true } },
    },
  });

  const roleName = caller?.customRole?.name?.toUpperCase();
  if (!roleName || !ADMIN_ROLES.includes(roleName)) {
    return NextResponse.json({ error: "Tidak memiliki izin" }, { status: 403 });
  }

  return {
    id: session.user.id,
    companyId: caller?.companyId ?? null,
    roleName,
    permissions: caller?.customRole?.permissions ?? [],
  };
}

/**
 * Resolves the current session caller with their role and permissions.
 * Does NOT enforce admin role — use this when you only need to check a specific permission.
 * Returns null if not authenticated.
 */
export async function getCaller(): Promise<AdminCaller | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const caller = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      companyId: true,
      customRole: { select: { name: true, permissions: true } },
    },
  });

  return {
    id: session.user.id,
    companyId: caller?.companyId ?? null,
    roleName: caller?.customRole?.name ?? "",
    permissions: caller?.customRole?.permissions ?? [],
  };
}

/**
 * Middleware helper for page/API routes that require a specific permission.
 * Returns the caller if authorized, or a 401/403 NextResponse.
 */
export async function requirePermission(
  permission: Permission
): Promise<AdminCaller | NextResponse> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  const caller = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      companyId: true,
      customRole: { select: { name: true, permissions: true } },
    },
  });

  const permissions = caller?.customRole?.permissions ?? [];
  if (!can(permissions, permission)) {
    return NextResponse.json({ error: "Tidak memiliki izin" }, { status: 403 });
  }

  return {
    id: session.user.id,
    companyId: caller?.companyId ?? null,
    roleName: caller?.customRole?.name ?? "",
    permissions,
  };
}
