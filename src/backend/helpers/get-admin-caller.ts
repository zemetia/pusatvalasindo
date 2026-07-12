import { cache } from "react";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import type { Permission } from "@/lib/permissions";
import { can } from "@/lib/permissions";

const ADMIN_ROLES = ["SUPER_ADMIN", "OWNER", "KEPALA_CABANG"];

export type AdminCaller = {
  id: string;
  companyId: string | null;
  branchId: string | null;
  roleName: string;
  permissions: string[];
};

type CallerRecord = {
  id: string;
  name: string;
  email: string;
  companyId: string | null;
  branchId: string | null;
  roleName: string;
  permissions: string[];
} | null;

/**
 * Resolves the session + user/role/permissions once per request. Wrapped in
 * React's `cache()` so that layout.tsx, a page.tsx rendered under it, and any
 * getAdminCaller/getCaller/requirePermission calls made during the same
 * request all share a single session lookup + a single user query instead of
 * each re-hitting the database independently.
 */
export const getCallerRecord = cache(async (): Promise<CallerRecord> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      companyId: true,
      branchId: true,
      customRole: { select: { name: true, permissions: true } },
    },
  });
  if (!user) return null;

  return {
    id: session.user.id,
    name: user.name,
    email: user.email,
    companyId: user.companyId,
    branchId: user.branchId,
    roleName: user.customRole?.name ?? "",
    permissions: user.customRole?.permissions ?? [],
  };
});

/**
 * Validates session and role in a single reusable call.
 * Returns AdminCaller on success, or a NextResponse (401/403) on failure.
 * Usage: const caller = await getAdminCaller(); if (caller instanceof NextResponse) return caller;
 */
export async function getAdminCaller(): Promise<AdminCaller | NextResponse> {
  const caller = await getCallerRecord();
  if (!caller) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  const roleName = caller.roleName.toUpperCase();
  if (!roleName || !ADMIN_ROLES.includes(roleName)) {
    return NextResponse.json({ error: "Tidak memiliki izin" }, { status: 403 });
  }

  return {
    id: caller.id,
    companyId: caller.companyId,
    branchId: caller.branchId,
    roleName,
    permissions: caller.permissions,
  };
}

/**
 * Resolves the current session caller with their role and permissions.
 * Does NOT enforce admin role — use this when you only need to check a specific permission.
 * Returns null if not authenticated.
 */
export async function getCaller(): Promise<AdminCaller | null> {
  const caller = await getCallerRecord();
  if (!caller) return null;

  return {
    id: caller.id,
    companyId: caller.companyId,
    branchId: caller.branchId,
    roleName: caller.roleName,
    permissions: caller.permissions,
  };
}

/**
 * Middleware helper for page/API routes that require a specific permission.
 * Returns the caller if authorized, or a 401/403 NextResponse.
 */
export async function requirePermission(
  permission: Permission
): Promise<AdminCaller | NextResponse> {
  const caller = await getCallerRecord();
  if (!caller) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  if (!can(caller.permissions, permission)) {
    return NextResponse.json({ error: "Tidak memiliki izin" }, { status: 403 });
  }

  return {
    id: caller.id,
    companyId: caller.companyId,
    branchId: caller.branchId,
    roleName: caller.roleName,
    permissions: caller.permissions,
  };
}
