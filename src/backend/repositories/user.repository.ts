import prisma from "@/lib/prisma";

export type UpdateUserInput = Partial<{
  name: string;
  image: string;
  phone: string;
  customRoleId: string | null;
  branchId: string | null;
  baseSalary: number | null;
  mealAllowance: number | null;
  transportAllowance: number | null;
  positionAllowance: number | null;
  bpjsKesehatan: number | null;
  joinDate: Date;
  isActive: boolean;
}>;

const select = {
  id: true,
  name: true,
  email: true,
  emailVerified: true,
  image: true,
  phone: true,
  customRoleId: true,
  branchId: true,
  baseSalary: true,
  mealAllowance: true,
  transportAllowance: true,
  positionAllowance: true,
  bpjsKesehatan: true,
  joinDate: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  branch: { select: { id: true, name: true } },
  customRole: { select: { id: true, name: true } },
};

export const userRepository = {
  findAll: (onlyActive = false) =>
    prisma.user.findMany({
      where: onlyActive ? { isActive: true } : undefined,
      select,
      orderBy: [{ branch: { name: "asc" } }, { name: "asc" }],
    }),

  findById: (id: string) =>
    prisma.user.findUnique({ where: { id }, select }),

  findByBranch: (branchId: string, onlyActive = false) =>
    prisma.user.findMany({
      where: { branchId, ...(onlyActive ? { isActive: true } : {}) },
      select,
      orderBy: { name: "asc" },
    }),

  findByEmail: (email: string) =>
    prisma.user.findUnique({ where: { email }, select }),

  update: (id: string, data: UpdateUserInput) =>
    prisma.user.update({
      where: { id },
      data: { ...data, updatedAt: new Date() },
      select,
    }),

  delete: async (id: string): Promise<void> => {
    await prisma.user.delete({ where: { id } });
  },
};
