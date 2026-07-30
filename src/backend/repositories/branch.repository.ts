import prisma from "@/lib/prisma";

export type CreateBranchInput = {
  name: string;
  address?: string;
  phone?: string;
  companyId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  attendanceRadiusM?: number | null;
};

export type UpdateBranchInput = Partial<CreateBranchInput & { isActive: boolean }>;

export const branchRepository = {
  /**
   * `companyIds` null berarti seluruh PT (tanpa penyaringan); array kosong
   * berarti tidak ada PT satu pun, jadi hasilnya nol baris — gagal ke arah aman.
   */
  findAll: (onlyActive = false, companyIds: string[] | null = null) =>
    prisma.branch.findMany({
      where: {
        ...(onlyActive ? { isActive: true } : {}),
        ...(companyIds === null ? {} : { companyId: { in: companyIds } }),
      },
      orderBy: { name: "asc" },
    }),

  findById: (id: string) =>
    prisma.branch.findUnique({ where: { id } }),

  create: (data: CreateBranchInput) =>
    prisma.branch.create({ data }),

  update: (id: string, data: UpdateBranchInput) =>
    prisma.branch.update({ where: { id }, data }),

  delete: async (id: string): Promise<void> => {
    await prisma.branch.delete({ where: { id } });
  },
};
