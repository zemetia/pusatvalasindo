import prisma from "@/lib/prisma";
import { StockistMutationType } from "@src/generated/prisma/client";
import { ConflictError, NotFoundError, ValidationError } from "@/backend/errors/app-error";
import { correctionRequestRepository } from "@/backend/repositories/correction-request.repository";
import { kasDailyEntryRepository } from "@/backend/repositories/kas-daily-entry.repository";
import { dailyBankEntryRepository } from "@/backend/repositories/daily-bank-entry.repository";
import { applyMutationInTx } from "@/backend/services/stockist.service";

// Persetujuan koreksi: satu-satunya jalan angka hasil verifikasi H+1 benar-benar mengubah
// data. Sebelum di-approve, pengajuan cuma catatan — saldo stock/kas/bank tidak tersentuh.

/** Stock: saldo berjalan digeser lewat mutasi ADJUSTMENT, bukan di-set langsung, supaya jejaknya ada di riwayat mutasi. */
async function applyStockistCorrection(req: {
  pocketId: string | null;
  companyStockItemId: string | null;
  proposedValue: unknown;
  reason: string;
  decidedBy?: string | null;
}) {
  if (!req.pocketId || !req.companyStockItemId) {
    throw new ValidationError("Pengajuan stock tidak lengkap (pocket / item kosong)");
  }
  const pocketId = req.pocketId;
  const companyStockItemId = req.companyStockItemId;
  const proposed = Number(req.proposedValue);

  await prisma.$transaction(async (tx) => {
    const balance = await tx.stockistBalance.findUnique({
      where: { pocketId_companyStockItemId: { pocketId, companyStockItemId } },
    });
    // Saldo dibaca ulang di sini, bukan memakai `currentValue` saat pengajuan dibuat —
    // kalau ada mutasi lain sejak pengajuan, hasil akhirnya tetap persis angka usulan.
    const delta = proposed - (balance ? Number(balance.quantity) : 0);
    if (delta === 0) return;

    await applyMutationInTx(tx, {
      pocketId,
      companyStockItemId,
      type: StockistMutationType.ADJUSTMENT,
      quantity: delta,
      note: `Koreksi disetujui: ${req.reason}`,
      createdBy: req.decidedBy ?? undefined,
    });
  });
}

export const correctionService = {
  list: correctionRequestRepository.findPage,
  countPending: correctionRequestRepository.countPending,

  getById: async (id: string) => {
    const req = await correctionRequestRepository.findById(id);
    if (!req) throw new NotFoundError("Pengajuan koreksi tidak ditemukan");
    return req;
  },

  approve: async (id: string, decidedBy: string, decisionNote?: string) => {
    const req = await correctionRequestRepository.findById(id);
    if (!req) throw new NotFoundError("Pengajuan koreksi tidak ditemukan");
    if (req.status !== "PENDING") {
      throw new ConflictError("Pengajuan ini sudah diputuskan sebelumnya");
    }

    const appliedNote = `Koreksi disetujui: ${req.reason}`;

    if (req.target === "STOCKIST") {
      await applyStockistCorrection({ ...req, decidedBy });
    } else if (req.target === "KAS") {
      if (!req.kasPocketId) throw new ValidationError("Pengajuan kas tidak lengkap");
      const entry = await kasDailyEntryRepository.findByPocketAndDate(req.kasPocketId, req.date);
      if (!entry) throw new NotFoundError("Entri kas yang dikoreksi sudah tidak ada");
      await kasDailyEntryRepository.applyApprovedCorrection(
        entry.id,
        Number(req.proposedValue),
        appliedNote
      );
    } else {
      if (!req.bankAccountId) throw new ValidationError("Pengajuan bank tidak lengkap");
      const entry = await dailyBankEntryRepository.findByAccountAndDate(req.bankAccountId, req.date);
      if (!entry) throw new NotFoundError("Entri bank yang dikoreksi sudah tidak ada");
      await dailyBankEntryRepository.applyApprovedCorrection(
        entry.id,
        Number(req.proposedValue),
        appliedNote
      );
    }

    return prisma.correctionRequest.update({
      where: { id },
      data: { status: "APPROVED", decidedBy, decidedAt: new Date(), decisionNote },
    });
  },

  // Ditolak: data tetap seperti semula dan status verifikasi entri dibiarkan "Beda",
  // jadi selisihnya masih kelihatan dan bisa diajukan ulang dengan angka lain.
  reject: async (id: string, decidedBy: string, decisionNote?: string) => {
    const req = await correctionRequestRepository.findById(id);
    if (!req) throw new NotFoundError("Pengajuan koreksi tidak ditemukan");
    if (req.status !== "PENDING") {
      throw new ConflictError("Pengajuan ini sudah diputuskan sebelumnya");
    }

    return prisma.correctionRequest.update({
      where: { id },
      data: { status: "REJECTED", decidedBy, decidedAt: new Date(), decisionNote },
    });
  },
};
