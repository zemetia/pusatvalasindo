import prisma from "@/lib/prisma";

export const bankMutationRepository = {
  findByAccount: (bankAccountId: string) =>
    prisma.bankMutation.findMany({
      where: { bankAccountId },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),

  findById: (id: string) =>
    prisma.bankMutation.findUnique({ where: { id } }),
};
