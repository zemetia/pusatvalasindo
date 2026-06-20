import prisma from "@/lib/prisma";
import { BonusResultType } from "@src/generated/prisma/client";

export type CreateBonusMatrixInput = {
  companyId: string;
  customRoleId?: string | null;
};

export type CreateBonusTierInput = {
  matrixId: string;
  minScore: number;
  maxScore: number;
  resultType: BonusResultType;
  amount?: number;
  isTopPerformer?: boolean;
};

const matrixSelect = {
  id: true,
  companyId: true,
  customRoleId: true,
  tiers: {
    orderBy: { minScore: "asc" as const },
  },
};

export const bonusMatrixRepository = {
  findAll: () =>
    prisma.bonusMatrix.findMany({
      include: {
        company: { select: { name: true, code: true } },
        customRole: { select: { name: true } },
        tiers: true,
      },
    }),

  findByCompanyRole: (companyId: string, customRoleId?: string) =>
    prisma.bonusMatrix.findFirst({
      where: { companyId, customRoleId },
      include: { tiers: true },
    }),

  createMatrix: (data: CreateBonusMatrixInput) =>
    prisma.bonusMatrix.create({ data, include: { tiers: true } }),

  addTier: (data: CreateBonusTierInput) =>
    prisma.bonusTier.create({ data }),

  deleteTier: (id: string) =>
    prisma.bonusTier.delete({ where: { id } }),

  deleteMatrix: (id: string) =>
    prisma.bonusMatrix.delete({ where: { id } }),
};
