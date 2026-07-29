import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getCallerRecord } from "@/backend/helpers/get-admin-caller";
import { can, isGlobalRole, type Permission } from "@/lib/permissions";

/**
 * Server-component auth guard for dashboard pages. Reuses the request-cached
 * `getCallerRecord()` (already resolved once in the dashboard layout), so pages
 * no longer re-run `getSession` + a user query of their own.
 *
 * Redirects to login when unauthenticated, or to the dashboard when the caller
 * lacks `permission`. Returns the caller record otherwise.
 */
export async function requirePageCaller(permission: Permission, locale: string) {
  const caller = await getCallerRecord();
  if (!caller) redirect(`/${locale}/login`);
  if (!can(caller.permissions, permission)) redirect(`/${locale}/dashboard`);
  return caller;
}

/**
 * Guard untuk halaman yang hanya boleh dilihat role global (Owner & Super Admin),
 * mis. Laporan Finance yang menampilkan posisi keuangan seluruh PT sekaligus.
 *
 * Sengaja role-gated, bukan permission-gated — sama alasannya dengan halaman
 * Pengguna (lihat `isAdminRole` di lib/permissions): daftar permission tersimpan
 * di DB per role, jadi gating lewat permission bisa melenceng kalau role di-seed
 * ulang. Kepala Cabang tidak boleh masuk ke sini: ia hanya berhak atas PT-nya.
 */
export async function requireGlobalPageCaller(locale: string) {
  const caller = await getCallerRecord();
  if (!caller) redirect(`/${locale}/login`);
  if (!isGlobalRole(caller.roleName)) redirect(`/${locale}/dashboard`);
  return caller;
}

export type CompanyScope = {
  /** True for global roles (Super Admin/Owner) — may pick any PT. */
  canSelectCompany: boolean;
  /** The caller's PT (derived from their branch), or null for global/unassigned. */
  effectiveCompanyId: string | null;
  /** PTs the caller may see: all of them when global, else just their own. */
  companies: { id: string; name: string }[];
  /** Preselected PT: null when the caller can freely choose, else their own PT. */
  defaultCompanyId: string | null;
};

/**
 * Resolves the standard per-PT scope shared by every PT-scoped page (stockist,
 * bank, cross-check, …): global roles see all active PTs and pick freely; every
 * other role is locked to the PT derived from their branch. A non-global caller
 * without a PT sees no company (never "all PTs").
 */
export async function getScopedCompanies(caller: {
  roleName: string;
  companyId: string | null;
}): Promise<CompanyScope> {
  const canSelectCompany = isGlobalRole(caller.roleName);
  const effectiveCompanyId = caller.companyId;
  const companies = await prisma.company.findMany({
    where: {
      isActive: true,
      ...(canSelectCompany ? {} : { id: effectiveCompanyId ?? "" }),
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const defaultCompanyId = canSelectCompany ? null : effectiveCompanyId;
  return { canSelectCompany, effectiveCompanyId, companies, defaultCompanyId };
}
