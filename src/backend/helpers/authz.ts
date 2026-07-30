// ─── Guard sisi server untuk sistem izin per-resource & per-PT ───────────────
// Dipakai oleh page (server component) dan API route. Padanan lama:
//   requirePageCaller(PERMISSIONS.X)  →  requireResource("resource", "view")
//   requirePermission(PERMISSIONS.X)  →  authorize("resource", "write", {...})

import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { getCallerRecord } from "@/backend/helpers/get-admin-caller";
import { fail } from "@/backend/helpers/api-response";
import { ForbiddenError } from "@/backend/errors/app-error";
import { isGlobalRole } from "@/lib/permissions";
import {
  resolve,
  allows,
  allowsCompany,
  companyFilter,
  type Action,
  type AuthzDecision,
  type AuthzSubject,
} from "@/lib/authz/resolve";
import type { ResourceKey } from "@/lib/authz/resources";

/**
 * Konteks izin milik pemanggil untuk satu resource. `companyIds` sudah siap
 * dipakai di klausa `where`; `canWrite(companyId)` adalah gerbang untuk mutasi.
 */
export type Authz = {
  userId: string;
  roleName: string;
  /** PT pemanggil, diturunkan dari cabangnya. */
  companyId: string | null;
  branchId: string | null;
  resource: ResourceKey;
  /** Keputusan untuk aksi yang diminta. */
  decision: AuthzDecision;
  /** PT yang boleh dibaca. null = semua PT. */
  companyIds: string[] | null;
  /** Fragmen `where` Prisma untuk aksi yang diminta. */
  where: (field?: string) => Record<string, unknown>;
  /** Boleh menulis pada PT ini? Panggil untuk SETIAP mutasi, bukan sekali di depan. */
  canWrite: (companyId: string | null) => boolean;
  /** Boleh membaca PT ini? */
  canView: (companyId: string | null) => boolean;
  /**
   * Melempar ForbiddenError kalau PT ini di luar scope, memakai AKSI yang sama
   * dengan saat authz dibuat — jadi guard yang diminta "write" ikut memeriksa
   * scope tulis, bukan scope baca. Pengganti `assertCompanyAccess` lama, yang
   * membandingkan langsung dengan PT si pemanggil dan karenanya mustahil
   * dipakai untuk wewenang lintas PT.
   */
  assertCompany: (companyId: string | null) => void;
  /** Cek resource lain tanpa query DB tambahan (subject-nya sudah di-cache). */
  can: (resource: ResourceKey, action: Action) => boolean;
  subject: AuthzSubject;
};

type CallerLike = NonNullable<Awaited<ReturnType<typeof getCallerRecord>>>;

function toSubject(caller: CallerLike): AuthzSubject {
  return {
    roleName: caller.roleName,
    companyId: caller.companyId,
    grants: caller.resourceGrants,
    migrated: caller.usesResourcePerms,
    legacyPermissions: caller.permissions,
  };
}

/**
 * Mengambil subjek izin pemanggil. Ikut memakai cache request milik
 * `getCallerRecord`, jadi layout, page, dan API dalam satu request berbagi
 * satu query yang sama.
 */
export async function getAuthzSubject(): Promise<AuthzSubject | null> {
  const caller = await getCallerRecord();
  return caller ? toSubject(caller) : null;
}

/** Pemanggil dengan izin, untuk service yang memutuskan sendiri per baris data. */
export type AuthzCaller = { id: string; subject: AuthzSubject };

/**
 * Identitas + subjek izin dalam satu panggilan, untuk service yang gerbangnya
 * bergantung pada baris datanya (mis. entri KPI: PT-nya baru diketahui setelah
 * entrinya dibaca, jadi `authorize(..., { companyId })` di route belum bisa
 * memutuskan). Ikut cache request `getCallerRecord`, jadi tidak ada query
 * tambahan dibanding memanggil `getCaller()` saja.
 */
export async function getAuthzCaller(): Promise<AuthzCaller | null> {
  const caller = await getCallerRecord();
  return caller ? { id: caller.id, subject: toSubject(caller) } : null;
}

function build(
  caller: { id: string; branchId: string | null },
  subject: AuthzSubject,
  resource: ResourceKey,
  action: Action
): Authz {
  const decision = resolve(subject, resource, action);
  return {
    userId: caller.id,
    roleName: subject.roleName,
    companyId: subject.companyId,
    branchId: caller.branchId,
    resource,
    decision,
    companyIds: decision.companyIds,
    where: (field = "companyId") => companyFilter(decision, field),
    canWrite: (companyId) => allowsCompany(subject, resource, "write", companyId),
    canView: (companyId) => allowsCompany(subject, resource, "view", companyId),
    assertCompany: (companyId) => {
      if (!allowsCompany(subject, resource, action, companyId)) {
        throw new ForbiddenError("Tidak punya akses ke PT ini");
      }
    },
    can: (r, a) => allows(subject, r, a),
    subject,
  };
}

/**
 * PT yang boleh DIBERIKAN oleh si pemanggil saat mengelola jabatan — bukan PT
 * yang boleh dia baca. `null` berarti tak terbatas (role global); array berarti
 * hanya PT itu.
 *
 * Dipakai bersama oleh pembuatan/pengubahan jabatan dan penyimpanan matriks
 * izinnya, supaya batas eskalasinya sama persis di ketiga pintu itu. Pemanggil
 * non-global tanpa PT tidak boleh memberi apa pun (array kosong), bukan "semua".
 */
export function grantableCompanyIds(authz: Authz): string[] | null {
  if (isGlobalRole(authz.roleName)) return null;
  return authz.companyId ? [authz.companyId] : [];
}

/**
 * Guard halaman (server component). Mengarahkan ke login kalau belum masuk,
 * atau ke dashboard kalau tidak berhak. Mengembalikan konteks izin.
 *
 * ```ts
 * const authz = await requireResource("stockist.daily", "view", locale);
 * const rows = await prisma.stockistDaily.findMany({ where: { ...authz.where(), tanggal } });
 * ```
 */
export async function requireResource(
  resource: ResourceKey,
  action: Action,
  locale: string
): Promise<Authz> {
  const caller = await getCallerRecord();
  if (!caller) redirect(`/${locale}/login`);

  const authz = build(caller, toSubject(caller), resource, action);
  if (!authz.decision.allowed) redirect(`/${locale}/dashboard`);
  return authz;
}

/**
 * Guard API route. Mengembalikan `NextResponse` (401/403) saat ditolak,
 * jadi pemakaiannya sama seperti `requirePermission` yang lama:
 *
 * ```ts
 * const authz = await authorize("bank.daily", "write", { companyId: body.companyId });
 * if (authz instanceof NextResponse) return authz;
 * ```
 *
 * Kalau `companyId` diberikan, PT itu ikut diperiksa terhadap scope — inilah
 * yang membuat "boleh lihat PT A+B, tapi hanya boleh ubah PT A" benar-benar
 * ditegakkan, bukan sekadar gerbang boolean.
 */
export async function authorize(
  resource: ResourceKey,
  action: Action,
  opts: { companyId?: string | null } = {}
): Promise<Authz | NextResponse> {
  const caller = await getCallerRecord();
  if (!caller) {
    return NextResponse.json(fail("UNAUTHORIZED", "Tidak terautentikasi"), { status: 401 });
  }

  const authz = build(caller, toSubject(caller), resource, action);
  if (!authz.decision.allowed) {
    return NextResponse.json(
      fail("FORBIDDEN", "Anda tidak memiliki izin untuk melakukan aksi ini"),
      { status: 403 }
    );
  }

  if (opts.companyId !== undefined) {
    const ok = action === "write" ? authz.canWrite(opts.companyId) : authz.canView(opts.companyId);
    if (!ok) {
      return NextResponse.json(
        fail("FORBIDDEN", "Anda tidak memiliki izin untuk PT ini"),
        { status: 403 }
      );
    }
  }

  return authz;
}
