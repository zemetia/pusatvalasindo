import prisma from "@/lib/prisma";

export type CreateCurrencyInput = {
  code: string;
  name: string;
  symbol?: string;
};

export type UpdateCurrencyInput = Partial<CreateCurrencyInput & { isActive: boolean }>;

export const currencyRepository = {
  findAll: (onlyActive = false) =>
    prisma.currency.findMany({
      where: onlyActive ? { isActive: true } : undefined,
      orderBy: { code: "asc" },
    }),

  findById: (id: string) =>
    prisma.currency.findUnique({ where: { id } }),

  findByCode: (code: string) =>
    prisma.currency.findUnique({ where: { code: code.toUpperCase() } }),

  create: (data: CreateCurrencyInput) =>
    prisma.currency.create({ data: { ...data, code: data.code.toUpperCase() } }),

  update: (id: string, data: UpdateCurrencyInput) =>
    prisma.currency.update({
      where: { id },
      data: { ...data, code: data.code ? data.code.toUpperCase() : undefined },
    }),

  delete: async (id: string): Promise<void> => {
    await prisma.currency.delete({ where: { id } });
  },
};
