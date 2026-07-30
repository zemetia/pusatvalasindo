// ─── Resolusi izin: resource + scope PT → keputusan konkret ──────────────────
// Modul ini murni (tanpa I/O, tanpa Prisma) sehingga bisa dipakai di server
// component, API route, maupun client component.

import { isGlobalRole } from "@/lib/permissions";
import { getResource, type ResourceKey } from "./resources";

export type ScopeMode = "NONE" | "OWN" | "SELECTED" | "ALL";

/** Satu baris RoleResourcePermission, bentuk polos agar aman dikirim ke client. */
export type ResourceGrant = {
  resource: string;
  viewScope: ScopeMode;
  viewCompanyIds: string[];
  writeScope: ScopeMode;
  writeCompanyIds: string[];
};

export type AuthzSubject = {
  roleName: string;
  /** PT si pemanggil, diturunkan dari cabangnya. */
  companyId: string | null;
  /** Baris izin per-resource milik jabatannya. */
  grants: ResourceGrant[];
  /**
   * True kalau jabatannya sudah dipindah ke matriks izin. Sengaja penanda
   * tersendiri, bukan `grants.length > 0`: jabatan yang seluruh izinnya dicabut
   * punya nol baris, dan menyimpulkan dari jumlah baris akan menghidupkan
   * kembali akses lamanya.
   */
  migrated: boolean;
  /** Array permission lama, dipakai sebagai fallback saat belum dimigrasi. */
  legacyPermissions: string[];
};

export type Action = "view" | "write";

/**
 * Hasil resolusi untuk satu resource + satu aksi.
 *
 * `companyIds` adalah daftar PT yang boleh dikenai aksi tersebut. Nilai `null`
 * berarti "semua PT" — jangan disamakan dengan array kosong, yang berarti
 * "tidak ada PT satu pun" dan harus menghasilkan hasil query kosong.
 */
export type AuthzDecision = {
  allowed: boolean;
  scope: ScopeMode;
  /** null = semua PT; [] = tidak ada PT. */
  companyIds: string[] | null;
};

const DENIED: AuthzDecision = { allowed: false, scope: "NONE", companyIds: [] };
const ALL_ACCESS: AuthzDecision = { allowed: true, scope: "ALL", companyIds: null };

/**
 * Menerjemahkan sebuah grant menjadi keputusan. `ownCompanyId` adalah PT si
 * pemanggil; kalau mode OWN dipakai tapi pemanggil tidak punya PT, hasilnya
 * ditolak — bukan "semua PT" — supaya user tanpa cabang tidak pernah bocor
 * melihat data lintas PT.
 */
function decide(mode: ScopeMode, companyIds: string[], ownCompanyId: string | null): AuthzDecision {
  switch (mode) {
    case "ALL":
      return ALL_ACCESS;
    case "SELECTED":
      return companyIds.length > 0
        ? { allowed: true, scope: "SELECTED", companyIds: [...companyIds] }
        : DENIED;
    case "OWN":
      return ownCompanyId
        ? { allowed: true, scope: "OWN", companyIds: [ownCompanyId] }
        : DENIED;
    default:
      return DENIED;
  }
}

/**
 * Fallback ke model izin lama saat sebuah jabatan belum dimigrasi.
 * Semantik lama tidak mengenal scope PT:
 * izinnya berlaku untuk PT jabatan itu sendiri, persis seperti perilaku
 * sebelum sistem ini ada. Ini yang membuat rollout bertahap tidak merusak apa pun.
 */
function resolveLegacy(
  resource: ResourceKey,
  action: Action,
  subject: AuthzSubject
): AuthzDecision {
  const def = getResource(resource);
  const needed = def?.legacy?.[action];
  if (!needed) return DENIED;
  if (!subject.legacyPermissions.includes(needed)) return DENIED;
  // Resource tanpa dimensi PT tidak boleh dipersempit ke PT si pemanggil.
  if (def.scoping && def.scoping !== "company") return ALL_ACCESS;
  return decide("OWN", [], subject.companyId);
}

/**
 * Keputusan izin untuk satu resource + aksi.
 *
 * Urutan penentuan:
 *   1. Role global (Super Admin / Owner) → selalu ALL. Ini jaring pengaman yang
 *      disengaja: salah konfigurasi matriks tidak boleh mengunci semua orang keluar.
 *   2. Resource self-scoped (data milik sendiri) → tidak ada dimensi PT.
 *   3. Jabatan belum dimigrasi → fallback ke permissions[] lama.
 *   4. Baris RoleResourcePermission untuk resource itu.
 *   5. Sudah dimigrasi tapi resource ini tidak diberikan → DITOLAK. Tidak jatuh
 *      balik ke izin lama, supaya pencabutan akses benar-benar berlaku.
 */
export function resolve(
  subject: AuthzSubject,
  resource: ResourceKey,
  action: Action
): AuthzDecision {
  if (isGlobalRole(subject.roleName)) return ALL_ACCESS;

  if (!subject.migrated) return resolveLegacy(resource, action, subject);

  const grant = subject.grants.find((g) => g.resource === resource);
  if (!grant) return DENIED;

  const mode = action === "view" ? grant.viewScope : grant.writeScope;
  const ids = action === "view" ? grant.viewCompanyIds : grant.writeCompanyIds;

  const def = getResource(resource);
  if (def?.scoping && def.scoping !== "company") {
    // Tanpa dimensi PT ("self" atau "global"): yang berlaku hanya punya-akses
    // atau tidak. `companyIds: null` berarti tidak ada penyaringan per PT.
    return mode === "NONE" ? DENIED : { allowed: true, scope: mode, companyIds: null };
  }

  return decide(mode, ids, subject.companyId);
}

/** Cukup boolean — untuk sidebar dan tampil/sembunyi tombol. */
export function allows(subject: AuthzSubject, resource: ResourceKey, action: Action): boolean {
  return resolve(subject, resource, action).allowed;
}

/** Boleh melakukan aksi pada PT tertentu? Inilah gerbang untuk setiap mutasi. */
export function allowsCompany(
  subject: AuthzSubject,
  resource: ResourceKey,
  action: Action,
  companyId: string | null
): boolean {
  const d = resolve(subject, resource, action);
  if (!d.allowed) return false;
  if (d.companyIds === null) return true;
  if (!companyId) return false;
  return d.companyIds.includes(companyId);
}

/**
 * Fragmen `where` Prisma untuk menyaring per PT. Kembaliannya digabung dengan
 * spread: `where: { ...companyFilter(d), tanggal }`.
 *
 * Saat tidak diizinkan atau daftar PT-nya kosong, dipakai `{ in: [] }` yang
 * menghasilkan nol baris — gagal ke arah aman, bukan membocorkan semuanya.
 */
export function companyFilter(
  decision: AuthzDecision,
  field: string = "companyId"
): Record<string, unknown> {
  if (decision.allowed && decision.companyIds === null) return {};
  return { [field]: { in: decision.allowed ? decision.companyIds ?? [] : [] } };
}
