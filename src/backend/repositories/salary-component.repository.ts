import prisma from "@/lib/prisma";
import type { Prisma, SalaryComponentKind } from "@src/generated/prisma/client";

/**
 * Komponen gaji tambahan — segalanya di luar gaji pokok (kolom tetap satu-
 * satunya yang masih di `user`), termasuk uang makan/transport/jabatan/BPJS.
 * Lihat komentar di prisma/schema/payroll.prisma untuk detailnya.
 */

export type CreateSalaryComponentInput = {
  companyId?: string | null;
  name: string;
  kind: SalaryComponentKind;
  defaultAmount?: number | null;
  note?: string | null;
  isActive?: boolean;
};

export type UpdateSalaryComponentInput = Partial<CreateSalaryComponentInput>;

const componentSelect = {
  id: true,
  companyId: true,
  name: true,
  kind: true,
  defaultAmount: true,
  note: true,
  isActive: true,
  company: { select: { name: true, code: true } },
} satisfies Prisma.SalaryComponentSelect;

export const salaryComponentRepository = {
  /**
   * `companyIds === null` berarti seluruh PT. Komponen global (companyId null)
   * selalu ikut, apa pun scope-nya — ia berlaku untuk semua PT.
   */
  findAll: (companyIds: string[] | null) =>
    prisma.salaryComponent.findMany({
      where:
        companyIds === null
          ? {}
          : { OR: [{ companyId: null }, { companyId: { in: companyIds } }] },
      select: componentSelect,
      orderBy: [{ kind: "asc" }, { name: "asc" }],
    }),

  // findFirst, bukan findUnique: companyId boleh null dan Prisma tidak menerima
  // null di dalam input unik gabungan.
  findByName: (companyId: string | null, name: string) =>
    prisma.salaryComponent.findFirst({
      where: { companyId, name },
      select: { id: true },
    }),

  findById: (id: string) =>
    prisma.salaryComponent.findUnique({ where: { id }, select: componentSelect }),

  create: (data: CreateSalaryComponentInput) =>
    prisma.salaryComponent.create({ data, select: componentSelect }),

  update: (id: string, data: UpdateSalaryComponentInput) =>
    prisma.salaryComponent.update({ where: { id }, data, select: componentSelect }),

  remove: async (id: string): Promise<void> => {
    await prisma.salaryComponent.delete({ where: { id } });
  },

  /** Berapa karyawan yang memakai komponen ini — dipakai sebelum menghapus. */
  countAssignments: (id: string) =>
    prisma.userSalaryComponent.count({ where: { componentId: id } }),

  /** Nilai komponen milik satu karyawan, termasuk komponen nonaktif. */
  findForUser: (userId: string) =>
    prisma.userSalaryComponent.findMany({
      where: { userId },
      select: {
        id: true,
        componentId: true,
        amount: true,
        component: {
          select: { name: true, kind: true, isActive: true, companyId: true },
        },
      },
      orderBy: [{ component: { kind: "asc" } }, { component: { name: "asc" } }],
    }),

  /**
   * Ganti seluruh set komponen milik karyawan dalam satu transaksi. Bentuk
   * "replace", bukan "patch": form karyawan mengirim daftar lengkap, jadi
   * komponen yang dihapus dari form ikut hilang tanpa panggilan terpisah.
   */
  replaceForUser: async (
    userId: string,
    items: { componentId: string; amount: number }[]
  ): Promise<void> => {
    const componentIds = items.map((i) => i.componentId);
    await prisma.$transaction([
      prisma.userSalaryComponent.deleteMany({
        where: { userId, componentId: { notIn: componentIds } },
      }),
      ...items.map((i) =>
        prisma.userSalaryComponent.upsert({
          where: { userId_componentId: { userId, componentId: i.componentId } },
          create: { userId, componentId: i.componentId, amount: i.amount },
          update: { amount: i.amount },
        })
      ),
    ]);
  },
};
