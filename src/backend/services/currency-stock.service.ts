import { currencyStockRepository } from "@/backend/repositories/currency-stock.repository";
import { NotFoundError, ForbiddenError } from "@/backend/errors/app-error";
import prisma from "@/lib/prisma";
import type { Authz } from "@/backend/helpers/authz";

/**
 * Padanan `Authz.assertCompany` untuk data yang melekat pada CABANG, bukan PT:
 * - Pemakai yang terikat satu cabang tetap terkunci ke cabangnya, sekalipun
 *   scope izinnya melebar ke seluruh PT — cabang selalu lebih sempit dari PT.
 * - Selain itu, PT pemilik cabang diuji terhadap scope izin (aksi yang sama
 *   dengan saat `authz` dibuat), jadi "boleh lihat PT A+B, hanya ubah PT A"
 *   ikut berlaku di sini.
 */
export async function assertBranchAccess(authz: Authz, branchId: string) {
  if (authz.branchId) {
    if (authz.branchId !== branchId) {
      throw new ForbiddenError("Tidak punya akses ke cabang ini");
    }
    return;
  }
  authz.assertCompany(await companyIdOfBranch(branchId));
}

/** PT pemilik sebuah cabang — sumber tunggal relasi cabang → PT untuk modul ini. */
export async function companyIdOfBranch(branchId: string): Promise<string | null> {
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { companyId: true },
  });
  if (!branch) throw new NotFoundError("Cabang tidak ditemukan");
  return branch.companyId;
}

export const currencyStockService = {
  getAll: (branchId?: string, currencyId?: string, companyIds?: string[] | null) =>
    currencyStockRepository.findAll(branchId, currencyId, companyIds),

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
