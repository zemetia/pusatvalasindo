import prisma from "@/lib/prisma";
import type {
  KpiDirection,
  KpiInputSource,
  KpiScoringType,
  KpiUnit,
} from "@src/generated/prisma/client";

export type CreateKpiDefinitionInput = {
  code: string;
  name: string;
  objective?: string | null;
  description?: string | null;
  scoringType: KpiScoringType;
  unit?: KpiUnit;
  direction?: KpiDirection;
  defaultInputSource?: KpiInputSource;
  defaultRequiresApproval?: boolean;
  defaultRequiresEvidence?: boolean;
  systemSourceKey?: string | null;
  isActive?: boolean;
};

export type UpdateKpiDefinitionInput = Partial<CreateKpiDefinitionInput>;

const select = {
  id: true,
  code: true,
  name: true,
  objective: true,
  description: true,
  scoringType: true,
  unit: true,
  direction: true,
  defaultInputSource: true,
  defaultRequiresApproval: true,
  defaultRequiresEvidence: true,
  systemSourceKey: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { roleKpis: true } },
};

export const kpiDefinitionRepository = {
  findAll: () =>
    prisma.kpiDefinition.findMany({
      select,
      orderBy: [{ scoringType: "asc" }, { name: "asc" }],
    }),

  findActive: () =>
    prisma.kpiDefinition.findMany({
      where: { isActive: true },
      select,
      orderBy: { name: "asc" },
    }),

  findById: (id: string) => prisma.kpiDefinition.findUnique({ where: { id }, select }),

  findByCode: (code: string) => prisma.kpiDefinition.findUnique({ where: { code }, select }),

  create: (data: CreateKpiDefinitionInput) => prisma.kpiDefinition.create({ data, select }),

  update: (id: string, data: UpdateKpiDefinitionInput) =>
    prisma.kpiDefinition.update({ where: { id }, data, select }),

  delete: async (id: string): Promise<void> => {
    await prisma.kpiDefinition.delete({ where: { id } });
  },
};
