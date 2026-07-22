import {
  kpiDefinitionRepository,
  CreateKpiDefinitionInput,
  UpdateKpiDefinitionInput,
} from "@/backend/repositories/kpi-definition.repository";
import {
  roleKpiRepository,
  CreateRoleKpiInput,
  UpdateRoleKpiInput,
} from "@/backend/repositories/role-kpi.repository";
import {
  kpiLogRepository,
  CreateKpiLogInput,
} from "@/backend/repositories/kpi-log.repository";
import {
  revenueRepository,
  CreateRevenueInput,
} from "@/backend/repositories/revenue.repository";
import { kpiMonthlyResultRepository } from "@/backend/repositories/kpi-monthly-result.repository";
import { NotFoundError } from "@/backend/errors/app-error";
import prisma from "@/lib/prisma";

export const kpiService = {
  // ── Definitions ──────────────────────────────────────────────────────────────
  getAllDefinitions: () => kpiDefinitionRepository.findAll(),

  getDefinitionById: async (id: string) => {
    const d = await kpiDefinitionRepository.findById(id);
    if (!d) throw new NotFoundError("Definisi KPI tidak ditemukan");
    return d;
  },

  createDefinition: (data: CreateKpiDefinitionInput) =>
    kpiDefinitionRepository.create(data),

  updateDefinition: async (id: string, data: UpdateKpiDefinitionInput) => {
    await kpiService.getDefinitionById(id);
    return kpiDefinitionRepository.update(id, data);
  },

  deleteDefinition: async (id: string) => {
    await kpiService.getDefinitionById(id);
    await kpiDefinitionRepository.delete(id);
  },

  // ── Role KPIs ────────────────────────────────────────────────────────────────
  getAllRoleKpis: () => roleKpiRepository.findAll(),

  getByCompanyRole: (companyId: string, customRoleId: string) =>
    roleKpiRepository.findByCompanyRole(companyId, customRoleId),

  getRoleKpiById: async (id: string) => {
    const r = await roleKpiRepository.findById(id);
    if (!r) throw new NotFoundError("Konfigurasi KPI jabatan tidak ditemukan");
    return r;
  },

  createRoleKpi: (data: CreateRoleKpiInput) => roleKpiRepository.create(data),

  updateRoleKpi: async (id: string, data: UpdateRoleKpiInput) => {
    await kpiService.getRoleKpiById(id);
    return roleKpiRepository.update(id, data);
  },

  deleteRoleKpi: async (id: string) => {
    await kpiService.getRoleKpiById(id);
    await roleKpiRepository.delete(id);
  },

  // ── KPI Logs ─────────────────────────────────────────────────────────────────
  getLogsByEmployee: (employeeId: string) =>
    kpiLogRepository.findByEmployee(employeeId),

  getLogsByEmployeePeriod: (employeeId: string, month: number, year: number) =>
    kpiLogRepository.findByEmployeePeriod(employeeId, month, year),

  createLog: (data: CreateKpiLogInput) => kpiLogRepository.create(data),

  deleteLog: (id: string) => kpiLogRepository.delete(id),

  // ── Revenues ─────────────────────────────────────────────────────────────────
  getRevenuesByEmployee: (employeeId: string) =>
    revenueRepository.findByEmployee(employeeId),

  getRevenuesByEmployeePeriod: (
    employeeId: string,
    month: number,
    year: number
  ) => revenueRepository.findByEmployeePeriod(employeeId, month, year),

  createRevenue: (data: CreateRevenueInput) => revenueRepository.create(data),

  deleteRevenue: (id: string) => revenueRepository.delete(id),

  // ── Monthly Results ───────────────────────────────────────────────────────────
  getMonthlyResult: (employeeId: string, month: number, year: number) =>
    kpiMonthlyResultRepository.findByEmployeePeriod(employeeId, month, year),

    calculateMonthlyResult: async (
    employeeId: string,
    month: number,
    year: number
  ) => {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);

    // Batch 1: employee lookup runs in parallel with logs + revenues
    // (logs/revenues only need employeeId + dateRange, both already known)
    const [employee, logs, revenues] = await Promise.all([
      prisma.user.findUnique({
        where: { id: employeeId },
        select: { customRoleId: true, branch: { select: { companyId: true } } },
      }),
      prisma.kpiLog.findMany({
        where: { employeeId, createdAt: { gte: startDate, lt: endDate } },
      }),
      prisma.revenue.findMany({
        where: { employeeId, date: { gte: startDate, lt: endDate } },
      }),
    ]);

    // PT karyawan diturunkan dari cabangnya (single source of truth).
    const employeeCompanyId = employee?.branch?.companyId;
    if (!employee?.customRoleId || !employeeCompanyId)
      throw new NotFoundError("Karyawan tidak memiliki jabatan atau perusahaan (PT)");

    // Batch 2: roleKpis + bonusMatrix both need companyId + customRoleId from batch 1
    const [roleKpis, matrix] = await Promise.all([
      prisma.roleKpi.findMany({
        where: { companyId: employeeCompanyId, customRoleId: employee.customRoleId },
        include: { definition: true },
      }),
      prisma.bonusMatrix.findUnique({
        where: {
          companyId_customRoleId: {
            companyId: employeeCompanyId,
            customRoleId: employee.customRoleId,
          },
        },
        include: { tiers: true },
      }),
    ]);

    // Aggregate logs and revenues
    const penaltyByKpi: Record<string, number> = {};
    for (const log of logs) {
      penaltyByKpi[log.kpiId] =
        (penaltyByKpi[log.kpiId] ?? 0) + Number(log.value);
    }

    const totalRevenue = revenues.reduce(
      (sum, r) => sum + Number(r.amount),
      0
    );

    const breakdownItems = [];
    let weightedTotalScore = 0;

    for (const rk of roleKpis) {
      const { definition, maxScore, threshold, targetValue, weight } = rk;
      const ms = Number(maxScore);
      const w = Number(weight);
      let achievementScore: number;
      let item: Record<string, string>;

      if (definition.type === "EVENT") {
        const totalPenalty = penaltyByKpi[definition.id] ?? 0;
        const thresh = Number(threshold ?? 100);
        const ratio = Math.max((thresh - totalPenalty) / thresh, 0);
        achievementScore = ms * ratio;
        item = {
          kpiId: definition.id,
          kpiName: definition.name,
          type: "EVENT",
          maxScore: ms.toString(),
          weight: w.toString(),
          threshold: thresh.toString(),
          totalPenalty: totalPenalty.toString(),
          score: achievementScore.toString(),
        };
      } else {
        const tv = Number(targetValue ?? 1);
        const achievementRatio = Math.min(tv > 0 ? totalRevenue / tv : 0, 1.2);
        achievementScore = ms * achievementRatio;
        item = {
          kpiId: definition.id,
          kpiName: definition.name,
          type: "TARGET",
          maxScore: ms.toString(),
          weight: w.toString(),
          targetValue: tv.toString(),
          actual: totalRevenue.toString(),
          achievement: achievementRatio.toString(),
          score: achievementScore.toString(),
        };
      }

      weightedTotalScore += achievementScore * w;
      breakdownItems.push(item);
    }

    let bonusAmount = 0;
    let bonusResult = undefined;

    if (matrix) {
      const normalizedScore = weightedTotalScore / 100; // Assuming scores are 0-100
      const tier = matrix.tiers.find(
        (t) =>
          normalizedScore >= Number(t.minScore) &&
          normalizedScore <= Number(t.maxScore)
      );

      if (tier) {
        bonusAmount = Number(tier.amount ?? 0);
        bonusResult = tier.resultType;
      }
    }

    return kpiMonthlyResultRepository.upsert({
      employeeId,
      month,
      year,
      totalScore: weightedTotalScore,
      bonusAmount,
      bonusResult,
      breakdownJson: { items: breakdownItems },
    });
  },
};
