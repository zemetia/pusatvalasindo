import type { AdminCaller } from "@/backend/helpers/get-admin-caller";
import { PERMISSIONS } from "@/lib/permissions";
import { ForbiddenError } from "@/backend/errors/app-error";
import { bankAccountRepository } from "@/backend/repositories/bank-account.repository";
import { dailyBankEntryRepository } from "@/backend/repositories/daily-bank-entry.repository";
import { correctionRequestRepository } from "@/backend/repositories/correction-request.repository";
import { todayDateOnly } from "@/backend/helpers/date-only";

/**
 * The complete payload the Saldo Bank Harian grid renders from.
 *
 * Shared by `GET /api/bank-harian` and the server-rendered Bank Harian page so the page
 * can ship its first grid inside the initial HTML instead of the client mounting,
 * hydrating, and only then firing a fetch — which on Vercel cost a whole extra
 * browser → function → database journey per page open. Both callers must go through this
 * function so the two paths can never drift apart.
 *
 * Enforces the caller's PT scope itself — do not call it with an unvalidated companyId.
 */
export async function buildBankHarianPayload(
  caller: AdminCaller,
  companyId: string,
  date: Date
) {
  if (caller.companyId && caller.companyId !== companyId) {
    throw new ForbiddenError("Tidak punya akses ke PT ini");
  }

  const [accounts, todayEntries, previousEntries, pendingCorrections] = await Promise.all([
    bankAccountRepository.findActiveForDaily(companyId),
    dailyBankEntryRepository.findByCompanyAndDate(companyId, date),
    dailyBankEntryRepository.findLatestBeforeDate(companyId, date),
    correctionRequestRepository.findPendingByCompanyDateTargets(companyId, date, ["BANK"]),
  ]);

  return {
    accounts: accounts.map((a) => ({
      id: a.id,
      bankName: a.bankName,
      accountNumber: a.accountNumber,
      accountName: a.accountName,
      currencyCode: a.currency.code,
      referenceBalance: a.balance.toString(),
      sortOrder: a.sortOrder,
    })),
    serverDate: todayDateOnly().toISOString().slice(0, 10),
    entries: Object.fromEntries(
      todayEntries.map((e) => [
        e.bankAccountId,
        {
          balance: e.balance.toString(),
          note: e.note,
          verifyStatus: e.verifyStatus,
          verifyNote: e.verifyNote,
        },
      ])
    ),
    // Sel yang koreksinya masih menunggu persetujuan ditandai di grid supaya user tidak
    // mengajukan ulang angka yang sama.
    pendingCorrections: Object.fromEntries(
      pendingCorrections
        .filter((c) => c.bankAccountId)
        .map((c) => [
          c.bankAccountId as string,
          { id: c.id, proposedValue: c.proposedValue.toString(), reason: c.reason },
        ])
    ),
    previous: Object.fromEntries(
      previousEntries.map((e) => [
        e.bankAccountId,
        { balance: e.balance.toString(), date: e.date.toISOString().slice(0, 10) },
      ])
    ),
    canInput: caller.permissions.includes(PERMISSIONS.BANK_DAILY_INPUT),
  };
}
