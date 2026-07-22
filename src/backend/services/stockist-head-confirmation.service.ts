import { ForbiddenError, NotFoundError } from "@/backend/errors/app-error";
import type { AdminCaller } from "@/backend/helpers/get-admin-caller";
import { isGlobalRole } from "@/lib/permissions";
import { companyStockItemRepository } from "@/backend/repositories/company-stock-item.repository";
import { stockistPocketRepository } from "@/backend/repositories/stockist-pocket.repository";
import { stockistDailyCheckRepository } from "@/backend/repositories/stockist-daily-check.repository";
import { kasPocketRepository } from "@/backend/repositories/kas-pocket.repository";
import { kasDailyEntryRepository } from "@/backend/repositories/kas-daily-entry.repository";
import { stockistHeadConfirmationRepository } from "@/backend/repositories/stockist-head-confirmation.repository";
import { kasHeadConfirmationRepository } from "@/backend/repositories/kas-head-confirmation.repository";
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

async function recomputeCompanyTotal(companyId: string, date: Date) {
  const [stockConfirmations, kasConfirmation] = await Promise.all([
    stockistHeadConfirmationRepository.findByCompanyAndDate(companyId, date),
    kasHeadConfirmationRepository.findByCompanyAndDate(companyId, date),
  ]);

  const stockTotal = stockConfirmations.reduce(
    (sum, c) => sum + Number(c.confirmedIdrValue),
    0
  );
  const kasTotal = kasConfirmation ? Number(kasConfirmation.confirmedIdrValue) : 0;

  return companyHeadConfirmationTotalRepository.upsert({
    companyId,
    date,
    totalIdr: stockTotal + kasTotal,
  });
}

export const stockistHeadConfirmationService = {
  // Total sistem per item = jumlah enteredQuantity teller dalam lintas pocket non-default, untuk
  // tanggal itu — sama seperti totalMap yang dihitung client-side di stockist-grid-client.tsx.
  getStockConfirmationGrid: async (companyId: string, date: Date) => {
    const [items, pockets, confirmations] = await Promise.all([
      companyStockItemRepository.findByCompany(companyId, true),
      stockistPocketRepository.findAllByCompany(companyId, true),
      stockistHeadConfirmationRepository.findByCompanyAndDate(companyId, date),
    ]);

    const realPocketIds = pockets.filter((p) => !p.isDefault).map((p) => p.id);
    const checks =
      realPocketIds.length > 0
        ? await stockistDailyCheckRepository.findByPocketsAndDate(realPocketIds, date)
        : [];

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
        confirmedIdrValue: confirmation ? Number(confirmation.confirmedIdrValue) : null,
        selisih: confirmedQuantity === null ? null : confirmedQuantity - systemTotal,
        isMatch: confirmedQuantity !== null && confirmedQuantity - systemTotal === 0,
        confirmedAt: confirmation?.confirmedAt ?? null,
      };
    });
  },

  upsertStockConfirmation: async (input: {
    companyId: string;
    companyStockItemId: string;
    date: Date;
    confirmedQuantity: number;
    confirmedIdrValue: number;
    note?: string;
    caller: AdminCaller;
  }) => {
    assertEditableDate(input.caller, input.date);

    const item = await companyStockItemRepository.findById(input.companyStockItemId);
    if (!item || item.companyId !== input.companyId) {
      throw new NotFoundError("Stock item tidak ditemukan");
    }

    const result = await stockistHeadConfirmationRepository.upsert({
      companyId: input.companyId,
      companyStockItemId: input.companyStockItemId,
      date: input.date,
      confirmedQuantity: input.confirmedQuantity,
      confirmedIdrValue: input.confirmedIdrValue,
      note: input.note,
      confirmedBy: input.caller.id,
    });

    await recomputeCompanyTotal(input.companyId, input.date);
    return result;
  },

  getKasConfirmation: async (companyId: string, date: Date) => {
    const [pockets, confirmation] = await Promise.all([
      kasPocketRepository.findAllByCompany(companyId, true),
      kasHeadConfirmationRepository.findByCompanyAndDate(companyId, date),
    ]);

    const entries = await kasDailyEntryRepository.findByCompanyAndDate(companyId, date);
    const pocketIds = new Set(pockets.map((p) => p.id));
    const systemTotal = entries
      .filter((e) => pocketIds.has(e.kasPocketId))
      .reduce((sum, e) => sum + Number(e.balance), 0);

    const confirmedIdrValue = confirmation ? Number(confirmation.confirmedIdrValue) : null;
    return {
      systemTotal,
      confirmedIdrValue,
      selisih: confirmedIdrValue === null ? null : confirmedIdrValue - systemTotal,
      isMatch: confirmedIdrValue !== null && confirmedIdrValue - systemTotal === 0,
      confirmedAt: confirmation?.confirmedAt ?? null,
    };
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

    await recomputeCompanyTotal(input.companyId, input.date);
    return result;
  },

  getCompanyTotal: (companyId: string, date: Date) =>
    companyHeadConfirmationTotalRepository.findByCompanyAndDate(companyId, date),
};
