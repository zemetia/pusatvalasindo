import prisma from "@/lib/prisma";
import type { PayrollIncentiveOutcome, Prisma } from "@src/generated/prisma/client";

/**
 * Matriks insentif payroll (dulu BonusMatrix). Berada di domain payroll karena
 * modul KPI hanya menghasilkan skor — lihat komentar di prisma/schema/kpi.prisma.
 */

export type CreateIncentiveMatrixInput = {
  companyId: string;
  customRoleId?: string | null;
  name?: string | null;
};

export type CreateIncentiveTierInput = {
  matrixId: string;
  minScore: number;
  maxScore: number;
  outcome: PayrollIncentiveOutcome;
  cashAmount?: number | null;
  mandatorySaturday?: boolean;
  topRank?: number | null;
  note?: string | null;
};

const tierSelect = {
  id: true,
  minScore: true,
  maxScore: true,
  outcome: true,
  cashAmount: true,
  mandatorySaturday: true,
  topRank: true,
  note: true,
};

const matrixSelect = {
  id: true,
  companyId: true,
  customRoleId: true,
  name: true,
  isActive: true,
  // Urut menurun agar pencocokan tier tertinggi (mis. ">120%") menang duluan.
  tiers: { select: tierSelect, orderBy: { minScore: "desc" } },
} satisfies Prisma.PayrollIncentiveMatrixSelect;

export type IncentiveMatrixRecord = NonNullable<
  Awaited<ReturnType<typeof payrollIncentiveRepository.findByCompanyRole>>
>;

export const payrollIncentiveRepository = {
  findAll: () =>
    prisma.payrollIncentiveMatrix.findMany({
      select: {
        ...matrixSelect,
        company: { select: { name: true, code: true } },
        customRole: { select: { name: true } },
      },
      orderBy: { companyId: "asc" },
    }),

  // findFirst, bukan findUnique: customRoleId boleh null dan Prisma tidak
  // menerima null di dalam input unik gabungan.
  findByCompanyRole: (companyId: string, customRoleId: string | null) =>
    prisma.payrollIncentiveMatrix.findFirst({
      where: { companyId, customRoleId },
      select: matrixSelect,
    }),

  createMatrix: (data: CreateIncentiveMatrixInput) =>
    prisma.payrollIncentiveMatrix.create({ data, select: matrixSelect }),

  addTier: (data: CreateIncentiveTierInput) =>
    prisma.payrollIncentiveTier.create({ data, select: tierSelect }),

  deleteTier: async (id: string): Promise<void> => {
    await prisma.payrollIncentiveTier.delete({ where: { id } });
  },

  deleteMatrix: async (id: string): Promise<void> => {
    await prisma.payrollIncentiveMatrix.delete({ where: { id } });
  },
};
