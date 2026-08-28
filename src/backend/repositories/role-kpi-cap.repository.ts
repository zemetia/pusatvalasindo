import prisma from "@/lib/prisma";

const select = {
  id: true,
  companyId: true,
  customRoleId: true,
  maxTotalScore: true,
  createdAt: true,
  updatedAt: true,
};

export const roleKpiCapRepository = {
  findByCompanyRole: (companyId: string, customRoleId: string) =>
    prisma.roleKpiCap.findUnique({
      where: { companyId_customRoleId: { companyId, customRoleId } },
      select,
    }),

  /** Null menghapus plafon (tidak ada baris = tidak ada batas). */
  upsert: (companyId: string, customRoleId: string, maxTotalScore: number | null) => {
    if (maxTotalScore === null) {
      return prisma.roleKpiCap.deleteMany({ where: { companyId, customRoleId } });
    }
    return prisma.roleKpiCap.upsert({
      where: { companyId_customRoleId: { companyId, customRoleId } },
      create: { companyId, customRoleId, maxTotalScore },
      update: { maxTotalScore },
      select,
    });
  },
};
