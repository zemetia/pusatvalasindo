import prisma from "@/lib/prisma";
import type { Prisma} from "@src/generated/prisma/client";
import { StockistCheckStatus, StockistMutationType } from "@src/generated/prisma/client";
import { ForbiddenError, NotFoundError, ValidationError } from "@/backend/errors/app-error";
import type { AdminCaller } from "@/backend/helpers/get-admin-caller";
import { stockistPocketRepository } from "@/backend/repositories/stockist-pocket.repository";
import { stockistBalanceRepository } from "@/backend/repositories/stockist-balance.repository";
import { stockistDailyCheckRepository } from "@/backend/repositories/stockist-daily-check.repository";
import { companyStockItemRepository } from "@/backend/repositories/company-stock-item.repository";
import { CompanyStockItemType } from "@src/generated/prisma/client";

type TxClient = Prisma.TransactionClient;

// OPENING/TOP_UP/TRANSFER_IN add to the balance; WITHDRAWAL/TRANSFER_OUT subtract.
// ADJUSTMENT carries its own signed delta (correction can go either direction).
const ADDITIVE_TYPES: StockistMutationType[] = [
  StockistMutationType.OPENING,
  StockistMutationType.TOP_UP,
  StockistMutationType.TRANSFER_IN,
];
const SUBTRACTIVE_TYPES: StockistMutationType[] = [
  StockistMutationType.WITHDRAWAL,
  StockistMutationType.TRANSFER_OUT,
];

export type ApplyMutationInput = {
  pocketId: string;
  companyStockItemId: string;
  type: StockistMutationType;
  quantity: number;
  note?: string;
  createdBy?: string;
};

async function applyMutationInTx(tx: TxClient, input: ApplyMutationInput) {
  if (input.type === StockistMutationType.ADJUSTMENT) {
    if (input.quantity === 0) throw new ValidationError("Quantity koreksi tidak boleh 0");
  } else if (input.quantity <= 0) {
    throw new ValidationError("Quantity harus lebih besar dari 0");
  }

  const existing = await tx.stockistBalance.findUnique({
    where: {
      pocketId_companyStockItemId: {
        pocketId: input.pocketId,
        companyStockItemId: input.companyStockItemId,
      },
    },
  });
  const currentQty = existing ? Number(existing.quantity) : 0;

  let delta: number;
  if (ADDITIVE_TYPES.includes(input.type)) delta = input.quantity;
  else if (SUBTRACTIVE_TYPES.includes(input.type)) delta = -input.quantity;
  else delta = input.quantity; // ADJUSTMENT

  const newQty = currentQty + delta;

  if (existing) {
    await tx.stockistBalance.update({ where: { id: existing.id }, data: { quantity: newQty } });
  } else {
    await tx.stockistBalance.create({
      data: {
        pocketId: input.pocketId,
        companyStockItemId: input.companyStockItemId,
        quantity: newQty,
      },
    });
  }

  return tx.stockistMutation.create({
    data: {
      pocketId: input.pocketId,
      companyStockItemId: input.companyStockItemId,
      type: input.type,
      quantity: input.quantity,
      balanceAfter: newQty,
      note: input.note,
      createdBy: input.createdBy,
    },
  });
}

/** Admin/Owner/Akuntan (no companyId on their user record) can act on any PT; everyone else is locked to their own. */
export function assertCompanyAccess(caller: AdminCaller, companyId: string) {
  if (caller.companyId && caller.companyId !== companyId) {
    throw new ForbiddenError("Tidak punya akses ke PT ini");
  }
}

// Dates flow through this module as UTC-midnight (parsed from "YYYY-MM-DD" query params), so
// "today" is compared the same way for consistency.
function todayDateOnly(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export const stockistService = {
  applyStockistMutation: (input: ApplyMutationInput) =>
    prisma.$transaction((tx) => applyMutationInTx(tx, input)),

  transferBetweenPockets: (input: {
    fromPocketId: string;
    toPocketId: string;
    companyStockItemId: string;
    quantity: number;
    note?: string;
    createdBy?: string;
  }) =>
    prisma.$transaction(async (tx) => {
      if (input.quantity <= 0) throw new ValidationError("Quantity harus lebih besar dari 0");
      const out = await applyMutationInTx(tx, {
        pocketId: input.fromPocketId,
        companyStockItemId: input.companyStockItemId,
        type: StockistMutationType.TRANSFER_OUT,
        quantity: input.quantity,
        note: input.note,
        createdBy: input.createdBy,
      });
      const incoming = await applyMutationInTx(tx, {
        pocketId: input.toPocketId,
        companyStockItemId: input.companyStockItemId,
        type: StockistMutationType.TRANSFER_IN,
        quantity: input.quantity,
        note: input.note,
        createdBy: input.createdBy,
      });
      return { out, in: incoming };
    }),

  // Grid lengkap untuk satu tanggal. Baris check TIDAK di-auto-create lagi untuk semua sel —
  // sel baru punya baris check setelah user benar-benar mengisi opname (lihat fillDailyCheck).
  getOrCreateGridForDate: async (companyId: string, date: Date) => {
    const [pockets, currencies] = await Promise.all([
      stockistPocketRepository.findAllByCompany(companyId, true),
      companyStockItemRepository.findByCompanyAndType(companyId, CompanyStockItemType.CURRENCY, true),
    ]);
    if (pockets.length === 0 || currencies.length === 0) {
      return { pockets, currencies, balances: [], checks: [], serverDate: todayDateOnly().toISOString().slice(0, 10) };
    }

    const pocketIds = pockets.map((p) => p.id);
    const [balances, checks] = await Promise.all([
      stockistBalanceRepository.findByPocketIds(pocketIds),
      stockistDailyCheckRepository.findByPocketsAndDate(pocketIds, date),
    ]);

    return { pockets, currencies, balances, checks, serverDate: todayDateOnly().toISOString().slice(0, 10) };
  },

  // Isi opname hari itu — hanya boleh untuk tanggal hari ini, dan hanya sekali (tidak bisa diubah
  // lewat sini setelah tersimpan; jadi angka yang direview besok pasti angka yang diisi hari itu).
  fillDailyCheck: async (input: {
    pocketId: string;
    companyStockItemId: string;
    date: Date;
    quantity: number;
    filledBy?: string;
  }) => {
    if (input.date.getTime() !== todayDateOnly().getTime()) {
      throw new ValidationError("Opname hanya bisa diisi untuk tanggal hari ini");
    }

    const existing = await stockistDailyCheckRepository.findByPocketItemDate(
      input.pocketId,
      input.companyStockItemId,
      input.date
    );
    if (existing?.enteredQuantity !== null && existing?.enteredQuantity !== undefined) {
      throw new ValidationError("Sel ini sudah diisi dan tidak bisa diubah");
    }

    return prisma.stockistDailyCheck.upsert({
      where: {
        pocketId_companyStockItemId_date: {
          pocketId: input.pocketId,
          companyStockItemId: input.companyStockItemId,
          date: input.date,
        },
      },
      create: {
        pocketId: input.pocketId,
        companyStockItemId: input.companyStockItemId,
        date: input.date,
        enteredQuantity: input.quantity,
        filledAt: new Date(),
        filledBy: input.filledBy,
      },
      update: {
        enteredQuantity: input.quantity,
        filledAt: new Date(),
        filledBy: input.filledBy,
      },
    });
  },

  markDailyCheck: async (input: {
    pocketId: string;
    companyStockItemId: string;
    date: Date;
    status: StockistCheckStatus;
    note?: string;
    correctedQuantity?: number;
    reviewedBy?: string;
  }) => {
    if (input.status === StockistCheckStatus.BEDA && !input.note) {
      throw new ValidationError("Catatan wajib diisi saat menandai Beda");
    }

    return prisma.$transaction(async (tx) => {
      const check = await tx.stockistDailyCheck.findUnique({
        where: {
          pocketId_companyStockItemId_date: {
            pocketId: input.pocketId,
            companyStockItemId: input.companyStockItemId,
            date: input.date,
          },
        },
      });
      if (!check || check.enteredQuantity === null) {
        throw new NotFoundError("Sel ini belum diisi opname — tidak ada yang bisa direview");
      }
      if (input.date.getTime() >= todayDateOnly().getTime()) {
        throw new ValidationError("Sel yang diisi hari ini baru bisa direview mulai besok");
      }

      if (input.status === StockistCheckStatus.BEDA && input.correctedQuantity !== undefined) {
        const balance = await tx.stockistBalance.findUnique({
          where: {
            pocketId_companyStockItemId: {
              pocketId: input.pocketId,
              companyStockItemId: input.companyStockItemId,
            },
          },
        });
        const currentQty = balance ? Number(balance.quantity) : 0;
        const delta = input.correctedQuantity - currentQty;
        if (delta !== 0) {
          await applyMutationInTx(tx, {
            pocketId: input.pocketId,
            companyStockItemId: input.companyStockItemId,
            type: StockistMutationType.ADJUSTMENT,
            quantity: delta,
            note: input.note,
            createdBy: input.reviewedBy,
          });
        }
      }

      return tx.stockistDailyCheck.update({
        where: { id: check.id },
        data: {
          status: input.status,
          note: input.note,
          reviewedBy: input.reviewedBy,
          reviewedAt: new Date(),
        },
      });
    });
  },

  getCompanyAlerts: async (companyId: string, date: Date) => {
    const [pockets, currencies] = await Promise.all([
      stockistPocketRepository.findAllByCompany(companyId, true),
      companyStockItemRepository.findByCompanyAndType(companyId, CompanyStockItemType.CURRENCY, true),
    ]);
    const totalCells = pockets.length * currencies.length;
    const isToday = date.getTime() === todayDateOnly().getTime();
    if (totalCells === 0) {
      return { beda: 0, belumReview: 0, belumIsi: 0, totalCells: 0, isToday };
    }

    const pocketIds = pockets.map((p) => p.id);
    const checks = await stockistDailyCheckRepository.findByPocketsAndDate(pocketIds, date);
    const filled = checks.filter((c) => c.enteredQuantity !== null);
    const beda = filled.filter((c) => c.status === StockistCheckStatus.BEDA).length;
    const benar = filled.filter((c) => c.status === StockistCheckStatus.BENAR).length;
    // Only filled cells are reviewable, and only once the day has passed — unfilled cells are
    // tracked separately as "belumIsi" rather than counted as a review alert.
    const belumReview = isToday ? 0 : filled.length - beda - benar;
    const belumIsi = totalCells - filled.length;
    return { beda, belumReview, belumIsi, totalCells, isToday };
  },
};
