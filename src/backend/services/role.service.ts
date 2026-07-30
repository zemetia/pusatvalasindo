import type {
  CreateRoleInput,
  UpdateRoleInput} from "@/backend/repositories/role.repository";
import {
  roleRepository
} from "@/backend/repositories/role.repository";
import { NotFoundError, ForbiddenError } from "@/backend/errors/app-error";
import { isReservedRoleName } from "@/lib/permissions";

/**
 * Batas eskalasi saat membuat/mengubah jabatan. `grantable` = daftar PT yang
 * boleh diberikan si pengatur (`null` = tak terbatas, yaitu Super Admin/Owner),
 * konvensi yang sama dengan `rolePermissionService.replaceForRole`.
 *
 * Dua hal yang dijaga:
 *   1. NAMA — "Owner"/"Super Admin" memberi akses seluruh PT lewat isGlobalRole,
 *      mendahului matriks izin. Tanpa penjagaan ini, pengelola jabatan yang
 *      didelegasikan bisa membuat jabatan bernama "Owner" lalu menaruh dirinya
 *      di sana: eskalasi penuh tanpa satu baris izin pun.
 *   2. PT — jabatan lintas PT (companyId null) dan jabatan milik PT lain sama-
 *      sama di luar wewenangnya, sejalan dengan aturan di matriks izin.
 */
function assertGrantable(
  grantable: string[] | null,
  data: { name?: string; companyId?: string | null }
) {
  if (grantable === null) return;

  if (data.name !== undefined && isReservedRoleName(data.name)) {
    throw new ForbiddenError(
      "Nama jabatan ini khusus Super Admin/Owner dan tidak bisa dipakai"
    );
  }

  if (data.companyId !== undefined) {
    if (!data.companyId) {
      throw new ForbiddenError(
        "Hanya Super Admin/Owner yang boleh membuat jabatan lintas PT"
      );
    }
    if (!grantable.includes(data.companyId)) {
      throw new ForbiddenError("Tidak boleh mengelola jabatan PT di luar wewenang Anda");
    }
  }
}

export const roleService = {
  getAll: () => roleRepository.findAll(),

  getByCompany: (companyId: string | null) => roleRepository.findByCompanyId(companyId),

  getById: async (id: string) => {
    const role = await roleRepository.findById(id);
    if (!role) throw new NotFoundError("Role not found");
    return role;
  },

  // `grantable` wajib diisi eksplisit di setiap pemanggilan (pakai
  // `grantableCompanyIds(authz)`), supaya batas eskalasi tidak pernah hilang
  // gara-gara parameter yang lupa diteruskan.
  // `async` supaya penolakannya datang sebagai promise yang reject, sama seperti
  // update/delete — bukan lemparan sinkron yang lolos dari `.catch()` pemanggil.
  create: async (data: CreateRoleInput, grantable: string[] | null) => {
    assertGrantable(grantable, { name: data.name, companyId: data.companyId ?? null });
    return roleRepository.create(data);
  },

  update: async (id: string, data: UpdateRoleInput, grantable: string[] | null) => {
    const role = await roleRepository.findById(id);
    if (!role) throw new NotFoundError("Role not found");
    // Jabatan yang SEDANG diubah ikut diuji — kalau tidak, jabatan "Owner" atau
    // jabatan PT lain masih bisa disentuh selama isian barunya terlihat wajar.
    assertGrantable(grantable, { name: role.name, companyId: role.companyId });
    assertGrantable(grantable, { name: data.name, companyId: data.companyId });
    return roleRepository.update(id, data);
  },

  delete: async (id: string, grantable: string[] | null) => {
    const role = await roleRepository.findById(id);
    if (!role) throw new NotFoundError("Role not found");
    assertGrantable(grantable, { name: role.name, companyId: role.companyId });
    await roleRepository.delete(id);
  },
};
