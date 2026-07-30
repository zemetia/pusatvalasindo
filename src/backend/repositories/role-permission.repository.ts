import prisma from "@/lib/prisma";
import type { ScopeMode } from "@/lib/authz/resolve";

export type ResourceGrantInput = {
  resource: string;
  viewScope: ScopeMode;
  viewCompanyIds: string[];
  writeScope: ScopeMode;
  writeCompanyIds: string[];
};

export const rolePermissionRepository = {
  findByRole: (roleId: string) =>
    prisma.roleResourcePermission.findMany({
      where: { roleId },
      orderBy: { resource: "asc" },
      select: {
        resource: true,
        viewScope: true,
        viewCompanyIds: true,
        writeScope: true,
        writeCompanyIds: true,
      },
    }),

  /**
   * Mengganti seluruh matriks izin sebuah jabatan dalam satu transaksi.
   *
   * Sengaja replace-all, bukan upsert per baris: matriks dikirim utuh dari UI,
   * jadi resource yang hilang dari kiriman berarti izinnya dicabut. Upsert
   * parsial akan meninggalkan baris yatim yang diam-diam tetap memberi akses.
   */
  replaceForRole: async (roleId: string, grants: ResourceGrantInput[]): Promise<void> => {
    await prisma.$transaction([
      prisma.roleResourcePermission.deleteMany({ where: { roleId } }),
      ...(grants.length > 0
        ? [prisma.roleResourcePermission.createMany({ data: grants.map((g) => ({ ...g, roleId })) })]
        : []),
      // Menyimpan matriks berarti jabatan ini resmi memakai sistem baru. Wajib
      // ikut di transaksi yang sama: kalau tidak, menyimpan matriks kosong akan
      // menyisakan jabatan itu di mode lama dan izin lamanya tetap hidup.
      prisma.custom_role.update({ where: { id: roleId }, data: { usesResourcePerms: true } }),
    ]);
  },
};
