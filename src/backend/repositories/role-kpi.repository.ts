import prisma from "@/lib/prisma";
import type { KpiInputSource, KpiToleranceScope, Prisma } from "@src/generated/prisma/client";

/** Parameter penilaian; mana yang dipakai tergantung scoringType definisinya. */
export type RoleKpiScoringParams = {
  weight: number;
  /**
   * Parameter kolektor otomatis; bentuknya bergantung systemSourceKey definisi.
   * Memakai tipe Prisma langsung karena kolom Json yang nullable menerima
   * `Prisma.DbNull`, bukan `null` biasa.
   */
  systemConfig?: Prisma.RoleKpiCreateInput["systemConfig"];
  targetValue?: number | null;
  basePoint?: number | null;
  pointPerUnit?: number | null;
  toleranceLimit?: number | null;
  toleranceScope?: KpiToleranceScope | null;
  maxAchievement?: number | null;
  inputSource?: KpiInputSource | null;
  requiresApproval?: boolean | null;
  requiresEvidence?: boolean | null;
  isActive?: boolean;
};

export type CreateRoleKpiInput = RoleKpiScoringParams & {
  companyId: string;
  customRoleId?: string | null;
  kpiId: string;
};

export type UpdateRoleKpiInput = Partial<RoleKpiScoringParams>;

const select = {
  id: true,
  companyId: true,
  customRoleId: true,
  kpiId: true,
  weight: true,
  targetValue: true,
  basePoint: true,
  pointPerUnit: true,
  toleranceLimit: true,
  toleranceScope: true,
  maxAchievement: true,
  inputSource: true,
  requiresApproval: true,
  requiresEvidence: true,
  systemConfig: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  definition: {
    select: {
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
    },
  },
  company: { select: { id: true, name: true, code: true } },
  customRole: { select: { id: true, name: true } },
};

export const roleKpiRepository = {
  findAll: () =>
    prisma.roleKpi.findMany({
      select,
      orderBy: [{ company: { name: "asc" } }, { definition: { name: "asc" } }],
    }),

  findByCompanyRole: (companyId: string, customRoleId?: string) =>
    prisma.roleKpi.findMany({
      where: { companyId, customRoleId },
      select,
      orderBy: [{ weight: "desc" }, { definition: { name: "asc" } }],
    }),

  /** Hanya konfigurasi aktif — dipakai engine penilaian dan form pengisian. */
  findActiveByCompanyRole: (companyId: string, customRoleId: string) =>
    prisma.roleKpi.findMany({
      where: { companyId, customRoleId, isActive: true },
      select,
      orderBy: [{ weight: "desc" }, { definition: { name: "asc" } }],
    }),

  findById: (id: string) => prisma.roleKpi.findUnique({ where: { id }, select }),

  create: (data: CreateRoleKpiInput) => prisma.roleKpi.create({ data, select }),

  update: (id: string, data: UpdateRoleKpiInput) =>
    prisma.roleKpi.update({ where: { id }, data, select }),

  delete: async (id: string): Promise<void> => {
    await prisma.roleKpi.delete({ where: { id } });
  },
};

export type RoleKpiRecord = NonNullable<Awaited<ReturnType<typeof roleKpiRepository.findById>>>;
