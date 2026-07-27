import { ForbiddenError, NotFoundError } from "@/backend/errors/app-error";
import type { AdminCaller } from "@/backend/helpers/get-admin-caller";
import { isGlobalRole } from "@/lib/permissions";
import { companyStockItemRepository } from "@/backend/repositories/company-stock-item.repository";
import { stockistDailyCheckRepository } from "@/backend/repositories/stockist-daily-check.repository";
import { kasPocketRepository } from "@/backend/repositories/kas-pocket.repository";
import { kasDailyEntryRepository } from "@/backend/repositories/kas-daily-entry.repository";
import { dailyBankEntryRepository } from "@/backend/repositories/daily-bank-entry.repository";
import { stockistHeadConfirmationRepository } from "@/backend/repositories/stockist-head-confirmation.repository";
import { stockistTotalHeadConfirmationRepository } from "@/backend/repositories/stockist-total-head-confirmation.repository";
import { kasHeadConfirmationRepository } from "@/backend/repositories/kas-head-confirmation.repository";
import { bankHeadConfirmationRepository } from "@/backend/repositories/bank-head-confirmation.repository";
import { companyHeadConfirmationTotalRepository } from "@/backend/repositories/company-head-confirmation-total.repository";

// Dates flow through this module as UTC-midnight (parsed from "YYYY-MM-DD" query params), matching
// the convention used in stockist.service.ts, so date comparisons stay consistent across modules.
function todayDateOnly(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Kepala Cabang can only edit today's confirmation; editing a past date requires a global role (Super Admin/Owner). */
function assertEditableDate(caller: AdminCaller, date: Date) {
  const isPast = date.getTime() < todayDateOnly().getTime();
  const canEditPastDate = isGlobalRole(caller.roleName);
  if (isPast && !canEditPastDate) {
    throw new ForbiddenError(
      "Tanggal sudah lewat — edit perlu otorisasi Super Admin/Owner"
    );
  }
}

// Total keseluruhan PT = total IDR stock (satu angka final untuk valas + logam mulia)
// + total kas + total bank, semuanya hasil hitung ulang kepala cabang.
async function recomputeCompanyTotal(companyId: string, date: Date) {
  const [stockTotal, kasConfirmation, bankConfirmation] = await Promise.all([
    stockistTotalHeadConfirmationRepository.findByCompanyAndDate(companyId, date),
    kasHeadConfirmationRepository.findByCompanyAndDate(companyId, date),
    bankHeadConfirmationRepository.findByCompanyAndDate(companyId, date),
  ]);

  const totalIdr =
    (stockTotal ? Number(stockTotal.confirmedIdrValue) : 0) +
    (kasConfirmation ? Number(kasConfirmation.confirmedIdrValue) : 0) +
    (bankConfirmation ? Number(bankConfirmation.confirmedIdrValue) : 0);

  return companyHeadConfirmationTotalRepository.upsert({ companyId, date, totalIdr });
}

type StockItem = Awaited<ReturnType<typeof companyStockItemRepository.findByCompany>>[number];
type StockCheck = Awaited<ReturnType<typeof stockistDailyCheckRepository.findByCompanyAndDate>>[number];
type StockConfirmation = Awaited<
  ReturnType<typeof stockistHeadConfirmationRepository.findByCompanyAndDate>
>[number];
type StockTotalRow = Awaited<
  ReturnType<typeof stockistTotalHeadConfirmationRepository.findByCompanyAndDate>
>;
type KasPocketRow = Awaited<ReturnType<typeof kasPocketRepository.findAllByCompany>>[number];
type KasEntryRow = Awaited<ReturnType<typeof kasDailyEntryRepository.findByCompanyAndDate>>[number];
type KasConfirmationRow = Awaited<
  ReturnType<typeof kasHeadConfirmationRepository.findByCompanyAndDate>
>;
type BankConfirmationRow = Awaited<
  ReturnType<typeof bankHeadConfirmationRepository.findByCompanyAndDate>
>;

// Total sistem per item = jumlah enteredQuantity teller dalam lintas pocket non-default, untuk
// tanggal itu — sama seperti totalMap yang dihitung client-side di stockist-grid-client.tsx.
function buildStockRows(
  items: StockItem[],
  checks: StockCheck[],
  confirmations: StockConfirmation[]
) {
  const systemTotals = new Map<string, number>();
  for (const check of checks) {
    if (check.enteredQuantity === null) continue;
    systemTotals.set(
      check.companyStockItemId,
      (systemTotals.get(check.companyStockItemId) ?? 0) + Number(check.enteredQuantity)
    );
  }

  const confirmationByItem = new Map(confirmations.map((c) => [c.companyStockItemId, c]));

  return items.map((item) => {
    const systemTotal = systemTotals.get(item.id) ?? 0;
    const confirmation = confirmationByItem.get(item.id);
    const confirmedQuantity = confirmation ? Number(confirmation.confirmedQuantity) : null;
    return {
      item,
      systemTotal,
      confirmedQuantity,
      selisih: confirmedQuantity === null ? null : confirmedQuantity - systemTotal,
      isMatch: confirmedQuantity !== null && confirmedQuantity - systemTotal === 0,
      confirmedAt: confirmation?.confirmedAt ?? null,
    };
  });
}

// Baris "Total" di bawah tabel stock: kuantitas beda mata uang memang dijumlahkan mentah —
// permintaan client, supaya selisih keseluruhan langsung kelihatan tanpa buka satu-satu.
// Nilai IDR-nya diisi sekali sebagai angka final, bukan hasil penjumlahan per item.
function buildStockTotals(
  rows: ReturnType<typeof buildStockRows>,
  totalConfirmation: StockTotalRow
) {
  const systemTotal = rows.reduce((sum, r) => sum + r.systemTotal, 0);
  const confirmedTotal = rows.reduce((sum, r) => sum + (r.confirmedQuantity ?? 0), 0);
  const confirmedIdrValue = totalConfirmation
    ? Number(totalConfirmation.confirmedIdrValue)
    : null;

  return {
    systemTotal,
    confirmedTotal,
    selisih: confirmedTotal - systemTotal,
    isMatch: confirmedTotal - systemTotal === 0,
    confirmedIdrValue,
    idrConfirmedAt: totalConfirmation?.confirmedAt ?? null,
  };
}

function buildKasSummary(
  pockets: KasPocketRow[],
  entries: KasEntryRow[],
  confirmation: KasConfirmationRow
) {
  const pocketIds = new Set(pockets.map((p) => p.id));
  const systemTotal = entries
    .filter((e) => pocketIds.has(e.kasPocketId))
    .reduce((sum, e) => sum + Number(e.balance), 0);

  return buildIdrSummary(systemTotal, confirmation);
}

// Kas dan bank sama-sama satu angka IDR: total sistem vs total hitung ulang kepala cabang.
function buildIdrSummary(
  systemTotal: number,
  confirmation: KasConfirmationRow | BankConfirmationRow
) {
  const confirmedIdrValue = confirmation ? Number(confirmation.confirmedIdrValue) : null;
  return {
    systemTotal,
    confirmedIdrValue,
    selisih: confirmedIdrValue === null ? null : confirmedIdrValue - systemTotal,
    isMatch: confirmedIdrValue !== null && confirmedIdrValue - systemTotal === 0,
    confirmedAt: confirmation?.confirmedAt ?? null,
  };
}

export const stockistHeadConfirmationService = {
  // Satu panggilan untuk seluruh halaman cross-check: stock grid + total stock + kas + bank +
  // total keseluruhan PT. Semua query independen ditembak dalam satu Promise.all (tanpa waterfall)
  // dan lewat satu request saja dari client — jauh lebih ringan dari endpoint terpisah yang
  // masing-masing re-auth.
  getFullConfirmation: async (companyId: string, date: Date) => {
    const [
      items,
      stockConfirmations,
      stockTotalConfirmation,
      checks,
      companyTotal,
      kasPockets,
      kasConfirmation,
      kasEntries,
      bankConfirmation,
      bankSystemTotal,
    ] = await Promise.all([
      companyStockItemRepository.findByCompany(companyId, true),
      stockistHeadConfirmationRepository.findByCompanyAndDate(companyId, date),
      stockistTotalHeadConfirmationRepository.findByCompanyAndDate(companyId, date),
      stockistDailyCheckRepository.findByCompanyAndDate(companyId, date),
      companyHeadConfirmationTotalRepository.findByCompanyAndDate(companyId, date),
      kasPocketRepository.findAllByCompany(companyId, true),
      kasHeadConfirmationRepository.findByCompanyAndDate(companyId, date),
      kasDailyEntryRepository.findByCompanyAndDate(companyId, date),
      bankHeadConfirmationRepository.findByCompanyAndDate(companyId, date),
      dailyBankEntryRepository.sumActiveByCompanyAndDate(companyId, date),
    ]);

    const rows = buildStockRows(items, checks, stockConfirmations);

    return {
      rows,
      stockTotals: buildStockTotals(rows, stockTotalConfirmation),
      companyTotal: companyTotal ? Number(companyTotal.totalIdr) : 0,
      kas: buildKasSummary(kasPockets, kasEntries, kasConfirmation),
      bank: buildIdrSummary(bankSystemTotal, bankConfirmation),
    };
  },

  getStockConfirmationGrid: async (companyId: string, date: Date) => {
    const [items, confirmations, checks] = await Promise.all([
      companyStockItemRepository.findByCompany(companyId, true),
      stockistHeadConfirmationRepository.findByCompanyAndDate(companyId, date),
      stockistDailyCheckRepository.findByCompanyAndDate(companyId, date),
    ]);
    return buildStockRows(items, checks, confirmations);
  },

  getStockTotalConfirmation: (companyId: string, date: Date) =>
    stockistTotalHeadConfirmationRepository.findByCompanyAndDate(companyId, date),

  upsertStockConfirmation: async (input: {
    companyId: string;
    companyStockItemId: string;
    date: Date;
    confirmedQuantity: number;
    note?: string;
    caller: AdminCaller;
  }) => {
    assertEditableDate(input.caller, input.date);

    const item = await companyStockItemRepository.findById(input.companyStockItemId);
    if (!item || item.companyId !== input.companyId) {
      throw new NotFoundError("Stock item tidak ditemukan");
    }

    // Hanya kuantitas — tidak mengubah nilai IDR, jadi total PT tidak perlu dihitung ulang.
    return stockistHeadConfirmationRepository.upsert({
      companyId: input.companyId,
      companyStockItemId: input.companyStockItemId,
      date: input.date,
      confirmedQuantity: input.confirmedQuantity,
      note: input.note,
      confirmedBy: input.caller.id,
    });
  },

  // Total IDR final untuk seluruh stock (valas + logam mulia) — diisi sekali di baris total.
  upsertStockTotalConfirmation: async (input: {
    companyId: string;
    date: Date;
    confirmedIdrValue: number;
    note?: string;
    caller: AdminCaller;
  }) => {
    assertEditableDate(input.caller, input.date);

    const result = await stockistTotalHeadConfirmationRepository.upsert({
      companyId: input.companyId,
      date: input.date,
      confirmedIdrValue: input.confirmedIdrValue,
      note: input.note,
      confirmedBy: input.caller.id,
    });

    // Kembalikan total PT hasil hitung-ulang di respons yang sama, supaya client tidak perlu
    // menembak GET ulang seluruh halaman hanya untuk memuat satu angka total.
    const total = await recomputeCompanyTotal(input.companyId, input.date);
    return { confirmation: result, companyTotal: Number(total.totalIdr) };
  },

  getKasConfirmation: async (companyId: string, date: Date) => {
    // Ketiga query saling independen — entries tidak perlu menunggu pockets — jadi paralel semua.
    const [pockets, confirmation, entries] = await Promise.all([
      kasPocketRepository.findAllByCompany(companyId, true),
      kasHeadConfirmationRepository.findByCompanyAndDate(companyId, date),
      kasDailyEntryRepository.findByCompanyAndDate(companyId, date),
    ]);
    return buildKasSummary(pockets, entries, confirmation);
  },

  upsertKasConfirmation: async (input: {
    companyId: string;
    date: Date;
    confirmedIdrValue: number;
    note?: string;
    caller: AdminCaller;
  }) => {
    assertEditableDate(input.caller, input.date);

    const result = await kasHeadConfirmationRepository.upsert({
      companyId: input.companyId,
      date: input.date,
      confirmedIdrValue: input.confirmedIdrValue,
      note: input.note,
      confirmedBy: input.caller.id,
    });

    // Sama seperti upsertStockTotalConfirmation: sertakan total PT terbaru di respons agar
    // client tidak perlu refetch penuh.
    const total = await recomputeCompanyTotal(input.companyId, input.date);
    return { confirmation: result, companyTotal: Number(total.totalIdr) };
  },

  // Total sistem bank = jumlah saldo harian (Bank Harian) seluruh rekening aktif PT pada
  // tanggal itu; seluruh rekening PT bermata uang IDR, jadi angkanya langsung sebanding.
  getBankConfirmation: async (companyId: string, date: Date) => {
    const [confirmation, systemTotal] = await Promise.all([
      bankHeadConfirmationRepository.findByCompanyAndDate(companyId, date),
      dailyBankEntryRepository.sumActiveByCompanyAndDate(companyId, date),
    ]);
    return buildIdrSummary(systemTotal, confirmation);
  },

  upsertBankConfirmation: async (input: {
    companyId: string;
    date: Date;
    confirmedIdrValue: number;
    note?: string;
    caller: AdminCaller;
  }) => {
    assertEditableDate(input.caller, input.date);

    const result = await bankHeadConfirmationRepository.upsert({
      companyId: input.companyId,
      date: input.date,
      confirmedIdrValue: input.confirmedIdrValue,
      note: input.note,
      confirmedBy: input.caller.id,
    });

    const total = await recomputeCompanyTotal(input.companyId, input.date);
    return { confirmation: result, companyTotal: Number(total.totalIdr) };
  },

  getCompanyTotal: (companyId: string, date: Date) =>
    companyHeadConfirmationTotalRepository.findByCompanyAndDate(companyId, date),
};
