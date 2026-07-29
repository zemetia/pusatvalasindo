import prisma from "@/lib/prisma";

const select = {
  id: true,
  employeeId: true,
  month: true,
  year: true,
  status: true,
  lockedAt: true,
  lockedById: true,
  note: true,
  lockedBy: { select: { id: true, name: true } },
};

export const kpiPeriodRepository = {
  find: (employeeId: string, month: number, year: number) =>
    prisma.kpiPeriod.findUnique({
      where: { employeeId_month_year: { employeeId, month, year } },
      select,
    }),

  /** Status periode untuk sekumpulan karyawan sekaligus (daftar tim). */
  findManyForPeriod: (employeeIds: string[], month: number, year: number) =>
    prisma.kpiPeriod.findMany({
      where: { employeeId: { in: employeeIds }, month, year },
      select,
    }),

  lock: (employeeId: string, month: number, year: number, lockedById: string, note?: string) =>
    prisma.kpiPeriod.upsert({
      where: { employeeId_month_year: { employeeId, month, year } },
      create: {
        employeeId,
        month,
        year,
        status: "LOCKED",
        lockedAt: new Date(),
        lockedById,
        note,
      },
      update: { status: "LOCKED", lockedAt: new Date(), lockedById, note },
      select,
    }),

  unlock: (employeeId: string, month: number, year: number, note?: string) =>
    prisma.kpiPeriod.upsert({
      where: { employeeId_month_year: { employeeId, month, year } },
      create: { employeeId, month, year, status: "OPEN", note },
      update: { status: "OPEN", lockedAt: null, lockedById: null, note },
      select,
    }),
};
