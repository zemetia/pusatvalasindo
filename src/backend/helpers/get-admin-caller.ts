import { cache } from "react";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import type { Permission } from "@/lib/permissions";
import { can, isAdminRole } from "@/lib/permissions";
import { fail } from "./api-response";

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

  // Single round-trip: user + branch (→ companyId) + custom_role in ONE query via explicit
  // LEFT JOINs. Prisma's default relation-load strategy runs each nested `select`/`include`
  // relation as a SEPARATE query (this client has no `relationJoins`), so the previous
  // findUnique with two relation selects cost 3 network round trips to the remote DB on every
  // request. Auth runs on every page render AND every API call, so this was the single biggest
  // per-request latency source.
  const rows = await prisma.$queryRaw<
    {
      name: string;
      email: string;
      branchId: string | null;
      companyId: string | null;
      roleName: string | null;
      permissions: string[] | null;
      payrollCompanyIds: string[] | null;
    }[]
  >`
    SELECT u."name",
           u."email",
           u."branchId",
           b."companyId"          AS "companyId",
           r."name"               AS "roleName",
           r."permissions"        AS "permissions",
           r."payrollCompanyIds"  AS "payrollCompanyIds"
    FROM "user" u
    LEFT JOIN "Branch"      b ON b."id" = u."branchId"
    LEFT JOIN "custom_role" r ON r."id" = u."customRoleId"
    WHERE u."id" = ${session.user.id}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;

  // A user's PT is derived solely from their branch — the single source of truth.
  // Branch-scoped roles (e.g. Kepala Cabang) are thereby locked to their PT, while
  // global roles (Super Admin/Owner) have no branch and stay unscoped.
  const companyId = row.companyId ?? null;

  return {
    id: session.user.id,
    name: row.name,
    email: row.email,
    companyId,
    branchId: row.branchId,
    roleName: row.roleName ?? "",
    permissions: row.permissions ?? [],
    payrollCompanyIds: row.payrollCompanyIds ?? [],
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
    return NextResponse.json(fail("UNAUTHORIZED", "Tidak terautentikasi"), { status: 401 });
  }

  // Role matching (incl. name normalization) lives in isAdminRole — the single
  // source of truth in lib/permissions.ts.
  if (!isAdminRole(caller.roleName)) {
    return NextResponse.json(fail("FORBIDDEN", "Anda tidak memiliki izin untuk melakukan aksi ini"), { status: 403 });
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
 * Requires only a valid session — no role, no permission.
 *
 * This is the guard the global middleware used to apply to every /api/* request.
 * That check moved into the routes themselves so the middleware no longer has to
 * import Prisma + Better Auth (which made every request pay for a heavyweight
 * middleware bundle). Routes that have a meaningful permission should use
 * `requirePermission`; this exists for endpoints where "logged in" genuinely is
 * the whole requirement, so that removing the middleware gate changes nothing.
 */
export async function requireAuth(): Promise<AdminCaller | NextResponse> {
  const caller = await getCallerRecord();
  if (!caller) {
    return NextResponse.json(fail("UNAUTHORIZED", "Tidak terautentikasi"), { status: 401 });
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

/**
 * Middleware helper for page/API routes that require a specific permission.
 * Returns the caller if authorized, or a 401/403 NextResponse.
 */
export async function requirePermission(
  permission: Permission
): Promise<AdminCaller | NextResponse> {
  const caller = await getCallerRecord();
  if (!caller) {
    return NextResponse.json(fail("UNAUTHORIZED", "Tidak terautentikasi"), { status: 401 });
  }

  if (!can(caller.permissions, permission)) {
    return NextResponse.json(fail("FORBIDDEN", "Anda tidak memiliki izin untuk melakukan aksi ini"), { status: 403 });
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
