import type { EmploymentStatus } from "@src/generated/prisma/client";
import prisma from "@/lib/prisma";

export type UpdateUserInput = Partial<{
  name: string;
  image: string;
  phone: string;
  customRoleId: string | null;
  branchId: string | null;
  baseSalary: number | null;
  joinDate: Date;
  isActive: boolean;
  // Ketiganya selalu ditulis bersama — status menentukan apakah tanggalnya
  // boleh terisi, jadi memperbarui salah satunya sendirian bisa meninggalkan
  // kombinasi yang mustahil (mis. BELUM_KONTRAK dengan tanggal mulai).
  // Penegakannya di route; tipe ini hanya membuka jalannya.
  employmentStatus: EmploymentStatus;
  contractStartDate: Date | null;
  contractEndDate: Date | null;
}>;

const select = {
  id: true,
  name: true,
  email: true,
  emailVerified: true,
  image: true,
  phone: true,
  customRoleId: true,
  branchId: true,
  baseSalary: true,
  joinDate: true,
  isActive: true,
  employmentStatus: true,
  contractStartDate: true,
  contractEndDate: true,
  createdAt: true,
  updatedAt: true,
  branch: { select: { id: true, name: true } },
  customRole: { select: { id: true, name: true } },
};

export const userRepository = {
  findAll: (onlyActive = false) =>
    prisma.user.findMany({
      where: onlyActive ? { isActive: true } : undefined,
      select,
      orderBy: [{ branch: { name: "asc" } }, { name: "asc" }],
    }),

  /**
   * Daftar pengguna dalam jangkauan izin pemanggil. `companyIds` null berarti
   * seluruh PT — dan sengaja TIDAK memasang filter `branch` sama sekali, supaya
   * pengguna yang belum punya cabang tetap ikut terlihat. Array kosong berarti
   * tidak ada PT satu pun, jadi hasilnya nol baris.
   */
  findScoped: (opts: {
    companyIds: string[] | null;
    branchId?: string | null;
    onlyActive?: boolean;
  }) =>
    prisma.user.findMany({
      where: {
        ...(opts.companyIds === null ? {} : { branch: { companyId: { in: opts.companyIds } } }),
        ...(opts.branchId ? { branchId: opts.branchId } : {}),
        ...(opts.onlyActive ? { isActive: true } : {}),
      },
      select,
      orderBy: [{ branch: { name: "asc" } }, { name: "asc" }],
    }),

  /** PT pemilik seorang pengguna, diturunkan dari cabangnya. */
  findCompanyOf: (id: string) =>
    prisma.user.findUnique({
      where: { id },
      select: { branch: { select: { companyId: true } } },
    }),

  findByCompany: (companyId: string, onlyActive = false) =>
    prisma.user.findMany({
      // A user's PT is derived from their branch, so scope by the branch's company.
      where: { branch: { companyId }, ...(onlyActive ? { isActive: true } : {}) },
      select,
      orderBy: [{ branch: { name: "asc" } }, { name: "asc" }],
    }),

  findById: (id: string) =>
    prisma.user.findUnique({ where: { id }, select }),

  findByBranch: (branchId: string, onlyActive = false) =>
    prisma.user.findMany({
      where: { branchId, ...(onlyActive ? { isActive: true } : {}) },
      select,
      orderBy: { name: "asc" },
    }),

  findByEmail: (email: string) =>
    prisma.user.findUnique({ where: { email }, select }),

  update: (id: string, data: UpdateUserInput) =>
    prisma.user.update({
      where: { id },
      data: { ...data, updatedAt: new Date() },
      select,
    }),

  delete: async (id: string): Promise<void> => {
    await prisma.user.delete({ where: { id } });
  },
};
