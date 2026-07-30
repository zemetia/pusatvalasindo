import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getCallerRecord } from "@/backend/helpers/get-admin-caller";
import { can, isGlobalRole, type Permission } from "@/lib/permissions";
import type { Authz } from "@/backend/helpers/authz";

/**
 * Server-component auth guard for dashboard pages. Reuses the request-cached
 * `getCallerRecord()` (already resolved once in the dashboard layout), so pages
 * no longer re-run `getSession` + a user query of their own.
 *
 * Redirects to login when unauthenticated, or to the dashboard when the caller
 * lacks `permission`. Returns the caller record otherwise.
 *
 * @deprecated Pakai `requireResource(resource, action, locale)`. Sama seperti
 * `requirePermission`, jabatan yang sudah memakai matriks izin ditolak di sini —
 * `permissions[]` lama tidak dikosongkan saat migrasi, jadi meloloskannya akan
 * membuat pencabutan izin di matriks tidak berarti apa-apa.
 */
export async function requirePageCaller(permission: Permission, locale: string) {
  const caller = await getCallerRecord();
  if (!caller) redirect(`/${locale}/login`);
  if (caller.usesResourcePerms) redirect(`/${locale}/dashboard`);
  if (!can(caller.permissions, permission)) redirect(`/${locale}/dashboard`);
  return caller;
}

// Dulu ada `requireGlobalPageCaller` di sini — gerbang "hanya Owner & Super
// Admin" untuk halaman lintas PT. Sudah dihapus: halaman terakhir yang
// memakainya (Laporan Finance) kini dijaga `requireResource("finance.report")`
// dengan `scoping: "global"`. Perilaku default-nya sama (tanpa peta legacy,
// jadi hanya role global), bedanya kini bisa didelegasikan lewat matriks izin.
// Halaman baru yang butuh gerbang lintas PT harus lewat resource, bukan
// gerbang peran tersendiri yang tak terlihat di UI Jabatan.

/**
 * Versi `getScopedCompanies` yang sadar resource: daftar PT-nya berasal dari
 * scope izin, bukan dari "global atau bukan". Inilah yang membuat sebuah
 * jabatan bisa memilih PT A dan PT B di satu halaman sementara di halaman lain
 * terkunci ke PT-nya sendiri.
 */
export async function getScopedCompaniesFor(authz: Authz): Promise<CompanyScope> {
  const companies = await prisma.company.findMany({
    where: { isActive: true, ...authz.where("id") },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  // Boleh memilih hanya kalau memang ada lebih dari satu PT dalam jangkauannya.
  // Kalau cuma satu PT yang terjangkau, langsung dipilihkan. Saat tidak ada
  // satu pun, hasilnya null — BUKAN PT si pemanggil, supaya scope kosong tidak
  // diam-diam berubah jadi akses ke PT sendiri.
  const canSelectCompany = companies.length > 1;
  const defaultCompanyId = canSelectCompany ? null : (companies[0]?.id ?? null);

  return {
    canSelectCompany,
    effectiveCompanyId: authz.companyId,
    companies,
    defaultCompanyId,
  };
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
