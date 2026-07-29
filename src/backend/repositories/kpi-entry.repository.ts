import prisma from "@/lib/prisma";
import type { KpiEntryStatus, KpiInputSource, Prisma } from "@src/generated/prisma/client";

export type CreateKpiEntryInput = {
  employeeId: string;
  roleKpiId: string;
  occurredAt: Date;
  periodYear: number;
  periodMonth: number;
  weekOfMonth: number;
  quantity: number;
  note?: string | null;
  evidenceUrl?: string | null;
  source: KpiInputSource;
  status: KpiEntryStatus;
  createdById: string;
};

export type UpdateKpiEntryInput = {
  quantity?: number;
  note?: string | null;
  evidenceUrl?: string | null;
};

const select = {
  id: true,
  employeeId: true,
  roleKpiId: true,
  occurredAt: true,
  periodYear: true,
  periodMonth: true,
  weekOfMonth: true,
  quantity: true,
  note: true,
  evidenceUrl: true,
  source: true,
  status: true,
  createdById: true,
  reviewedById: true,
  reviewedAt: true,
  reviewNote: true,
  createdAt: true,
  employee: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  reviewedBy: { select: { id: true, name: true } },
  roleKpi: {
    select: {
      id: true,
      companyId: true,
      customRoleId: true,
      weight: true,
      definition: {
        select: { id: true, code: true, name: true, scoringType: true, unit: true },
      },
    },
  },
};

export type KpiEntryRecord = Awaited<ReturnType<typeof kpiEntryRepository.findById>>;

export const kpiEntryRepository = {
  findById: (id: string) => prisma.kpiEntry.findUnique({ where: { id }, select }),

  findByEmployeePeriod: (
    employeeId: string,
    year: number,
    month: number,
    status?: KpiEntryStatus
  ) =>
    prisma.kpiEntry.findMany({
      where: { employeeId, periodYear: year, periodMonth: month, ...(status ? { status } : {}) },
      select,
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
    }),

  /**
   * Bahan perhitungan skor: hanya entri APPROVED, dan hanya kolom yang benar-
   * benar dipakai engine. Sengaja tidak memakai `select` lengkap di atas —
   * perhitungan bulanan bisa menarik ratusan baris per karyawan.
   */
  findApprovedForScoring: (employeeId: string, year: number, month: number) =>
    prisma.kpiEntry.findMany({
      where: { employeeId, periodYear: year, periodMonth: month, status: "APPROVED" },
      select: { roleKpiId: true, occurredAt: true, weekOfMonth: true, quantity: true },
    }),

  /** Antrian persetujuan; `where` sudah dibatasi cakupan PT oleh service. */
  findPending: (where: Prisma.KpiEntryWhereInput, limit = 200) =>
    prisma.kpiEntry.findMany({
      where: { ...where, status: "PENDING" },
      select,
      orderBy: { createdAt: "asc" },
      take: limit,
    }),

  countPending: (where: Prisma.KpiEntryWhereInput) =>
    prisma.kpiEntry.count({ where: { ...where, status: "PENDING" } }),

  create: (data: CreateKpiEntryInput) => prisma.kpiEntry.create({ data, select }),

  update: (id: string, data: UpdateKpiEntryInput) =>
    prisma.kpiEntry.update({ where: { id }, data, select }),

  review: (
    id: string,
    data: { status: KpiEntryStatus; reviewedById: string; reviewNote?: string | null }
  ) =>
    prisma.kpiEntry.update({
      where: { id },
      data: { ...data, reviewedAt: new Date() },
      select,
    }),

  delete: async (id: string): Promise<void> => {
    await prisma.kpiEntry.delete({ where: { id } });
  },
};
