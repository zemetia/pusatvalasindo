import { currencyStockRepository } from "@/backend/repositories/currency-stock.repository";
import { NotFoundError, ForbiddenError } from "@/backend/errors/app-error";
import prisma from "@/lib/prisma";
import type { AdminCaller } from "@/backend/helpers/get-admin-caller";

/**
 * Branch-level equivalent of stockist.service's assertCompanyAccess:
 * - Branch-scoped callers (caller.branchId set) can only see their own branch.
 * - Company-scoped-only callers (e.g. Kepala Cabang) can see any branch of
 *   their own PT, but not another PT's branch.
 * - Fully global callers (no branchId/companyId) can see any branch.
 */
export async function assertBranchAccess(caller: AdminCaller, branchId: string) {
  if (caller.branchId) {
    if (caller.branchId !== branchId) {
      throw new ForbiddenError("Tidak punya akses ke cabang ini");
    }
    return;
  }
  if (caller.companyId) {
    const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { companyId: true } });
    if (!branch || branch.companyId !== caller.companyId) {
      throw new ForbiddenError("Tidak punya akses ke cabang PT lain");
    }
  }
}

export const currencyStockService = {
  getAll: (branchId?: string, currencyId?: string) =>
    currencyStockRepository.findAll(branchId, currencyId),

  getById: async (id: string) => {
    const stock = await currencyStockRepository.findById(id);
    if (!stock) throw new NotFoundError("Currency stock not found");
    return stock;
  },

  updateRates: async (id: string, buyRate?: number, sellRate?: number) => {
    const stock = await currencyStockRepository.findById(id);
    if (!stock) throw new NotFoundError("Currency stock not found");
    return currencyStockRepository.updateRates(id, buyRate, sellRate);
  },
};
