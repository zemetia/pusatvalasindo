import prisma from "@/lib/prisma";
import { Prisma } from "@src/generated/prisma/client";
import type { CorrectionStatus, CorrectionTargetType } from "@src/generated/prisma/client";

export type CorrectionTargetRef = {
  pocketId?: string | null;
  companyStockItemId?: string | null;
  kasPocketId?: string | null;
  bankAccountId?: string | null;
};

/** Kolom target yang identik untuk satu sel data — dipakai untuk mencari pengajuan PENDING kembar. */
function targetWhere(target: CorrectionTargetType, ref: CorrectionTargetRef) {
  return {
    target,
    pocketId: ref.pocketId ?? null,
    companyStockItemId: ref.companyStockItemId ?? null,
    kasPocketId: ref.kasPocketId ?? null,
    bankAccountId: ref.bankAccountId ?? null,
  };
}

export const correctionRequestRepository = {
  findById: (id: string) => prisma.correctionRequest.findUnique({ where: { id } }),

  // Satu sel hanya boleh punya satu pengajuan PENDING pada satu tanggal; pengajuan ulang
  // menimpa yang lama (lihat correction.service) supaya antrian persetujuan tidak menumpuk.
  findPending: (
    companyId: string,
    target: CorrectionTargetType,
    ref: CorrectionTargetRef,
    date: Date
  ) =>
    prisma.correctionRequest.findFirst({
      where: { companyId, date, status: "PENDING", ...targetWhere(target, ref) },
    }),

  findPendingByCompanyDateTargets: (
    companyId: string,
    date: Date,
    targets: CorrectionTargetType[]
  ) =>
    prisma.correctionRequest.findMany({
      where: { companyId, date, status: "PENDING", target: { in: targets } },
      select: {
        id: true,
        target: true,
        pocketId: true,
        companyStockItemId: true,
        kasPocketId: true,
        bankAccountId: true,
        proposedValue: true,
        reason: true,
        requestedAt: true,
      },
    }),

  create: (input: {
    companyId: string;
    target: CorrectionTargetType;
    date: Date;
    ref: CorrectionTargetRef;
    targetLabel: string;
    currentValue: number;
    proposedValue: number;
    reason: string;
    requestedBy?: string | null;
  }) =>
    prisma.correctionRequest.create({
      data: {
        companyId: input.companyId,
        date: input.date,
        targetLabel: input.targetLabel,
        currentValue: new Prisma.Decimal(input.currentValue),
        proposedValue: new Prisma.Decimal(input.proposedValue),
        reason: input.reason,
        requestedBy: input.requestedBy,
        ...targetWhere(input.target, input.ref),
      },
    }),

  updatePending: (
    id: string,
    input: { currentValue: number; proposedValue: number; reason: string; requestedBy?: string | null }
  ) =>
    prisma.correctionRequest.update({
      where: { id },
      data: {
        currentValue: new Prisma.Decimal(input.currentValue),
        proposedValue: new Prisma.Decimal(input.proposedValue),
        reason: input.reason,
        requestedBy: input.requestedBy,
        requestedAt: new Date(),
      },
    }),

  findPage: (
    filters: {
      companyId?: string;
      status?: CorrectionStatus;
      target?: CorrectionTargetType;
      from?: Date;
      to?: Date;
    },
    take = 50,
    cursor?: string
  ) =>
    prisma.correctionRequest.findMany({
      where: {
        ...(filters.companyId ? { companyId: filters.companyId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.target ? { target: filters.target } : {}),
        ...(filters.from || filters.to
          ? {
              date: {
                ...(filters.from ? { gte: filters.from } : {}),
                ...(filters.to ? { lte: filters.to } : {}),
              },
            }
          : {}),
      },
      include: { company: { select: { id: true, name: true } } },
      orderBy: [{ status: "asc" }, { requestedAt: "desc" }],
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    }),

  countPending: (companyId?: string) =>
    prisma.correctionRequest.count({
      where: { status: "PENDING", ...(companyId ? { companyId } : {}) },
    }),
};
