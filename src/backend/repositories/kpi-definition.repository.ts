import prisma from "@/lib/prisma";
import { KpiType } from "@src/generated/prisma/client";

export type CreateKpiDefinitionInput = {
  name: string;
  type: KpiType;
};

export type UpdateKpiDefinitionInput = Partial<CreateKpiDefinitionInput>;

const select = {
  id: true,
  name: true,
  type: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { roleKpis: true, logs: true } },
};

export const kpiDefinitionRepository = {
  findAll: () =>
    prisma.kpiDefinition.findMany({
      select,
      orderBy: [{ type: "asc" }, { name: "asc" }],
    }),

  findById: (id: string) =>
    prisma.kpiDefinition.findUnique({ where: { id }, select }),

  create: (data: CreateKpiDefinitionInput) =>
    prisma.kpiDefinition.create({ data, select }),

  update: (id: string, data: UpdateKpiDefinitionInput) =>
    prisma.kpiDefinition.update({ where: { id }, data, select }),

  delete: async (id: string): Promise<void> => {
    await prisma.kpiDefinition.delete({ where: { id } });
  },
};
