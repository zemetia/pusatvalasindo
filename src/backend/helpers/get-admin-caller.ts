import { cache } from "react";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import type { Permission } from "@/lib/permissions";
import { can, isAdminRole } from "@/lib/permissions";

export type AdminCaller = {
  id: string;
  companyId: string | null;
  branchId: string | null;
  roleName: string;
  permissions: string[];
  payrollCompanyIds: string[];
};

type CallerRecord = {
  id: string;
  name: string;
  email: string;
  companyId: string | null;
  branchId: string | null;
  roleName: string;
  permissions: string[];
  payrollCompanyIds: string[];
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
      branchId: true,
      branch: { select: { companyId: true } },
      customRole: { select: { name: true, permissions: true, payrollCompanyIds: true } },
    },
  });
  if (!user) return null;

  // A user's PT is derived solely from their branch — the single source of truth.
  // Branch-scoped roles (e.g. Kepala Cabang) are thereby locked to their PT, while
  // global roles (Super Admin/Owner) have no branch and stay unscoped.
  const companyId = user.branch?.companyId ?? null;

  return {
    id: session.user.id,
    name: user.name,
    email: user.email,
    companyId,
    branchId: user.branchId,
    roleName: user.customRole?.name ?? "",
    permissions: user.customRole?.permissions ?? [],
    payrollCompanyIds: user.customRole?.payrollCompanyIds ?? [],
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

  // Role matching (incl. name normalization) lives in isAdminRole — the single
  // source of truth in lib/permissions.ts.
  if (!isAdminRole(caller.roleName)) {
    return NextResponse.json({ error: "Tidak memiliki izin" }, { status: 403 });
  }

  return {
    id: caller.id,
    companyId: caller.companyId,
    branchId: caller.branchId,
    // Raw role name (as stored) — consistent with getCaller/requirePermission.
    // Callers must classify it via isGlobalRole/isAdminRole, never string-compare.
    roleName: caller.roleName,
    permissions: caller.permissions,
    payrollCompanyIds: caller.payrollCompanyIds,
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
    payrollCompanyIds: caller.payrollCompanyIds,
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
    payrollCompanyIds: caller.payrollCompanyIds,
  };
}
