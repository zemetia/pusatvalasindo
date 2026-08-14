import { ForbiddenError, NotFoundError } from "@/backend/errors/app-error";
/**
 * Hanya dua hal yang dibutuhkan: siapa yang mengonfirmasi, dan apakah ia boleh
 * mengubah tanggal lampau. Sengaja bukan `AdminCaller` utuh supaya service ini
 * bisa dipanggil dengan konteks izin mana pun.
 */
type ConfirmationActor = {
  id: string;
  /** Boleh mengubah angka tanggal lampau untuk PT yang bersangkutan? */
  canBackdate: boolean;
};
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
function assertEditableDate(caller: ConfirmationActor, date: Date) {
  const isPast = date.getTime() < todayDateOnly().getTime();
  const canEditPastDate = caller.canBackdate;
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

function kasSystemTotal(pockets: KasPocketRow[], entries: KasEntryRow[]) {
  const pocketIds = new Set(pockets.map((p) => p.id));
  return entries
    .filter((e) => pocketIds.has(e.kasPocketId))
    .reduce((sum, e) => sum + Number(e.balance), 0);
}

/**
 * Menandai KLOP secara otomatis: begitu angka kepala cabang sama persis dengan total
 * sistem, jamnya dicatat sekali dan tidak digeser lagi oleh penyimpanan berikutnya.
 *
 * Dijalankan setiap ringkasan kas/bank dibaca — bukan hanya saat kepala cabang menyimpan —
 * karena selisihnya bisa tertutup dari sisi sebaliknya: saldo harian yang dibetulkan
 * setelah angka kepala cabang masuk. Kalau salah satu sisi berubah lagi dan selisihnya
 * terbuka, jam klopnya dihapus supaya tidak ada tanda klop yang menggantung.
 */
async function reconcileMatch<T extends { id: string; matchedAt: Date | null }>(
  confirmation: T | null,
  isMatch: boolean,
  persist: (id: string, matchedAt: Date | null) => Promise<T>
): Promise<T | null> {
  if (!confirmation) return null;
  if (isMatch && confirmation.matchedAt === null) {
    return persist(confirmation.id, new Date());
  }
  if (!isMatch && confirmation.matchedAt !== null) {
    return persist(confirmation.id, null);
  }
  return confirmation;
}

// Kas dan bank sama-sama satu angka IDR: total sistem vs total hitung ulang kepala cabang.
async function buildIdrSummary(
  systemTotal: number,
  confirmation: KasConfirmationRow | BankConfirmationRow,
  persistMatchedAt: (id: string, matchedAt: Date | null) => Promise<NonNullable<typeof confirmation>>
) {
  const confirmedIdrValue = confirmation ? Number(confirmation.confirmedIdrValue) : null;
  const isMatch = confirmedIdrValue !== null && confirmedIdrValue - systemTotal === 0;
  const synced = await reconcileMatch(confirmation, isMatch, persistMatchedAt);

  return {
    systemTotal,
    confirmedIdrValue,
    selisih: confirmedIdrValue === null ? null : confirmedIdrValue - systemTotal,
    isMatch,
    confirmedAt: synced?.confirmedAt ?? null,
    /** Jam klop tersimpan; null selama belum klop. */
    matchedAt: synced?.matchedAt ?? null,
  };
}

const buildKasSummary = (
  pockets: KasPocketRow[],
  entries: KasEntryRow[],
  confirmation: KasConfirmationRow
) =>
  buildIdrSummary(
    kasSystemTotal(pockets, entries),
    confirmation,
    kasHeadConfirmationRepository.setMatchedAt
  );

const buildBankSummary = (systemTotal: number, confirmation: BankConfirmationRow) =>
  buildIdrSummary(systemTotal, confirmation, bankHeadConfirmationRepository.setMatchedAt);

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
    // Reconcile klop kas & bank jalan di sini juga: halaman cross-check ikut menandai
    // klop begitu dibuka, tanpa menunggu angkanya disimpan ulang.
    const [kas, bank] = await Promise.all([
      buildKasSummary(kasPockets, kasEntries, kasConfirmation),
      buildBankSummary(bankSystemTotal, bankConfirmation),
    ]);

    return {
      rows,
      stockTotals: buildStockTotals(rows, stockTotalConfirmation),
      companyTotal: companyTotal ? Number(companyTotal.totalIdr) : 0,
      kas,
      bank,
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

  /**
   * Kuantitas hitung ulang kepala cabang per stock item — dibaca grid harian sebagai
   * pembanding kolom Total. Total sistemnya sengaja tidak ikut dihitung di sini: grid
   * sudah menjumlahkannya sendiri dari sel yang sedang tampil, jadi selisihnya ikut
   * bergerak begitu sel diperbaiki tanpa menunggu request ulang.
   */
  getStockItemConfirmations: async (companyId: string, date: Date) => {
    const rows = await stockistHeadConfirmationRepository.findByCompanyAndDate(companyId, date);
    return rows.map((r) => ({
      companyStockItemId: r.companyStockItemId,
      confirmedQuantity: Number(r.confirmedQuantity),
      confirmedAt: r.confirmedAt,
    }));
  },

  getStockTotalConfirmation: (companyId: string, date: Date) =>
    stockistTotalHeadConfirmationRepository.findByCompanyAndDate(companyId, date),

  upsertStockConfirmation: async (input: {
    companyId: string;
    companyStockItemId: string;
    date: Date;
    confirmedQuantity: number;
    note?: string;
    caller: ConfirmationActor;
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
    caller: ConfirmationActor;
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
    caller: ConfirmationActor;
  }) => {
    assertEditableDate(input.caller, input.date);

    await kasHeadConfirmationRepository.upsert({
      companyId: input.companyId,
      date: input.date,
      confirmedIdrValue: input.confirmedIdrValue,
      note: input.note,
      confirmedBy: input.caller.id,
    });

    // Ringkasannya dibaca ulang supaya status klop + jam klopnya ikut ditandai di sini
    // (reconcileMatch), lalu dikirim balik bersama total PT terbaru — client tidak perlu
    // refetch penuh hanya untuk tahu apakah angkanya sudah klop.
    const [summary, total] = await Promise.all([
      stockistHeadConfirmationService.getKasConfirmation(input.companyId, input.date),
      recomputeCompanyTotal(input.companyId, input.date),
    ]);
    return { confirmation: summary, companyTotal: Number(total.totalIdr) };
  },

  // Total sistem bank = jumlah saldo harian (Bank Harian) seluruh rekening aktif PT pada
  // tanggal itu; seluruh rekening PT bermata uang IDR, jadi angkanya langsung sebanding.
  getBankConfirmation: async (companyId: string, date: Date) => {
    const [confirmation, systemTotal] = await Promise.all([
      bankHeadConfirmationRepository.findByCompanyAndDate(companyId, date),
      dailyBankEntryRepository.sumActiveByCompanyAndDate(companyId, date),
    ]);
    return buildBankSummary(systemTotal, confirmation);
  },

  upsertBankConfirmation: async (input: {
    companyId: string;
    date: Date;
    confirmedIdrValue: number;
    note?: string;
    caller: ConfirmationActor;
  }) => {
    assertEditableDate(input.caller, input.date);

    await bankHeadConfirmationRepository.upsert({
      companyId: input.companyId,
      date: input.date,
      confirmedIdrValue: input.confirmedIdrValue,
      note: input.note,
      confirmedBy: input.caller.id,
    });

    // Lihat upsertKasConfirmation: status + jam klop ikut ditandai lewat pembacaan ulang.
    const [summary, total] = await Promise.all([
      stockistHeadConfirmationService.getBankConfirmation(input.companyId, input.date),
      recomputeCompanyTotal(input.companyId, input.date),
    ]);
    return { confirmation: summary, companyTotal: Number(total.totalIdr) };
  },

  getCompanyTotal: (companyId: string, date: Date) =>
    companyHeadConfirmationTotalRepository.findByCompanyAndDate(companyId, date),
};
