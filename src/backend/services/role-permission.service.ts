import {
  rolePermissionRepository,
  type ResourceGrantInput,
} from "@/backend/repositories/role-permission.repository";
import { roleRepository } from "@/backend/repositories/role.repository";
import { NotFoundError, ForbiddenError } from "@/backend/errors/app-error";
import { getResource } from "@/lib/authz/resources";

export const rolePermissionService = {
  getByRole: async (roleId: string) => {
    const role = await roleRepository.findById(roleId);
    if (!role) throw new NotFoundError("Role not found");
    return rolePermissionRepository.findByRole(roleId);
  },

  /**
   * Menyimpan matriks izin sebuah jabatan.
   *
   * `grantableCompanyIds` = daftar PT yang boleh diberikan oleh si pengatur.
   * `null` berarti tak terbatas (role global). Ini mencegah eskalasi hak: admin
   * PT A tidak boleh memberi jabatan apa pun akses ke PT B, baik lewat mode
   * SELECTED maupun ALL.
   */
  replaceForRole: async (
    roleId: string,
    grants: ResourceGrantInput[],
    grantableCompanyIds: string[] | null
  ) => {
    const role = await roleRepository.findById(roleId);
    if (!role) throw new NotFoundError("Role not found");

    const normalized: ResourceGrantInput[] = [];

    for (const g of grants) {
      const def = getResource(g.resource);
      if (!def) {
        throw new NotFoundError(`Resource tidak dikenal: ${g.resource}`);
      }

      // Resource tanpa dimensi PT ("self"/"global") tidak boleh menyimpan daftar
      // PT. Dinormalkan di sini, bukan dipercayakan ke UI, supaya request yang
      // dibuat manual tidak bisa menyelundupkan scope yang tak berlaku.
      if (def.scoping && def.scoping !== "company") {
        const view = g.viewScope === "NONE" ? "NONE" : "ALL";
        const write = g.writeScope === "NONE" ? "NONE" : "ALL";

        // Akses global efektif melintasi seluruh PT, jadi hanya Super Admin/Owner
        // yang boleh mendelegasikannya — sejalan dengan aturan ALL di bawah.
        //
        // Sengaja hanya `scoping: "global"`. Resource "self" ikut lewat cabang ini
        // karena sama-sama tanpa daftar PT, tapi isinya adalah data milik pemakai
        // sendiri (presensi, slip gaji, KPI-nya) — tidak melintasi PT mana pun,
        // jadi memberikannya bukan eskalasi. Sebelumnya keduanya digabung, dan
        // akibatnya pengelola jabatan yang didelegasikan tidak bisa menyimpan
        // matriks apa pun yang menyertakan izin "milik sendiri".
        if (def.scoping === "global" && grantableCompanyIds !== null && (view === "ALL" || write === "ALL")) {
          throw new ForbiddenError(
            `Hanya Super Admin/Owner yang boleh memberi akses global (${g.resource})`
          );
        }

        normalized.push({
          resource: g.resource,
          viewScope: view,
          viewCompanyIds: [],
          writeScope: write,
          writeCompanyIds: [],
        });
        continue;
      }

      normalized.push(g);
      if (grantableCompanyIds === null) continue;

      // ALL berarti "seluruh PT" — hanya boleh diberikan oleh role global.
      if (g.viewScope === "ALL" || g.writeScope === "ALL") {
        throw new ForbiddenError(
          `Hanya Super Admin/Owner yang boleh memberi akses seluruh PT (${g.resource})`
        );
      }
      const requested = [...g.viewCompanyIds, ...g.writeCompanyIds];
      const outside = requested.filter((id) => !grantableCompanyIds.includes(id));
      if (outside.length > 0) {
        throw new ForbiddenError(
          `Tidak boleh memberi akses ke PT di luar wewenang Anda (${g.resource})`
        );
      }
    }

    // Baris yang seluruhnya NONE tidak perlu disimpan — hasilnya sama dengan
    // tidak ada baris, dan tabelnya jadi jauh lebih ringan.
    const meaningful = normalized.filter((g) => g.viewScope !== "NONE" || g.writeScope !== "NONE");

    await rolePermissionRepository.replaceForRole(roleId, meaningful);
    return rolePermissionRepository.findByRole(roleId);
  },
};
