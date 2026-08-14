import { NotFoundError, ValidationError } from "@/backend/errors/app-error";
import { isPastDate } from "@/backend/helpers/date-only";
import { kasDailyEntryRepository } from "@/backend/repositories/kas-daily-entry.repository";
import { kasPocketRepository } from "@/backend/repositories/kas-pocket.repository";
import { dailyBankEntryRepository } from "@/backend/repositories/daily-bank-entry.repository";
import { bankAccountRepository } from "@/backend/repositories/bank-account.repository";
import { correctionRequestRepository } from "@/backend/repositories/correction-request.repository";
import type { CorrectionTargetType, DailyVerifyStatus } from "@src/generated/prisma/client";

// Verifikasi H+1 untuk entri harian Kas & Bank — kembaran dari alur review sel opname di
// grid stock (stockist.service.markDailyCheck). Aturannya sama persis:
//   • Hanya entri bertanggal LAMPAU yang bisa diverifikasi (yang diisi hari ini, besok).
//   • "Benar" = angkanya cocok, selesai.
//   • "Beda" = wajib catatan; angka pengganti (opsional) TIDAK langsung dipakai, tapi
//     diajukan sebagai CorrectionRequest dan baru berlaku setelah disetujui Owner/Super Admin.

type VerifyInput = {
  date: Date;
  status: Exclude<DailyVerifyStatus, "BELUM_REVIEW">;
  note?: string;
  correctedBalance?: number;
  verifiedBy?: string;
};

function assertVerifiable(input: VerifyInput) {
  if (!isPastDate(input.date)) {
    throw new ValidationError("Saldo yang diisi hari ini baru bisa diverifikasi mulai besok");
  }
  if (input.status === "BEDA" && !input.note?.trim()) {
    throw new ValidationError("Catatan wajib diisi saat menandai Beda");
  }
}

/**
 * Menyimpan hasil verifikasi + (kalau perlu) pengajuan koreksi. Dipakai bersama oleh Kas
 * dan Bank; yang berbeda cuma repository entri & identitas targetnya.
 */
async function verifyEntry(params: {
  entry: { id: string; balance: unknown };
  companyId: string;
  target: CorrectionTargetType;
  ref: { kasPocketId?: string; bankAccountId?: string };
  targetLabel: string;
  input: VerifyInput;
  markVerified: (
    id: string,
    data: { verifyStatus: DailyVerifyStatus; verifyNote?: string | null; verifiedBy?: string | null }
  ) => Promise<unknown>;
}) {
  const { entry, input } = params;

  const updated = await params.markVerified(entry.id, {
    verifyStatus: input.status,
    verifyNote: input.note ?? null,
    verifiedBy: input.verifiedBy ?? null,
  });

  const currentBalance = Number(entry.balance);
  if (
    input.status !== "BEDA" ||
    input.correctedBalance === undefined ||
    input.correctedBalance === currentBalance
  ) {
    return { entry: updated, correctionRequest: null };
  }

  const payload = {
    currentValue: currentBalance,
    proposedValue: input.correctedBalance,
    reason: input.note as string,
    requestedBy: input.verifiedBy,
  };

  // Pengajuan ulang untuk sel yang sama menimpa yang masih PENDING, supaya antrian
  // persetujuan tidak menumpuk untuk satu angka yang sama.
  const existing = await correctionRequestRepository.findPending(
    params.companyId,
    params.target,
    params.ref,
    input.date
  );

  const correctionRequest = existing
    ? await correctionRequestRepository.updatePending(existing.id, payload)
    : await correctionRequestRepository.create({
        companyId: params.companyId,
        target: params.target,
        date: input.date,
        ref: params.ref,
        targetLabel: params.targetLabel,
        ...payload,
      });

  return { entry: updated, correctionRequest };
}

export const dailyVerifyService = {
  verifyKas: async (input: VerifyInput & { kasPocketId: string }) => {
    assertVerifiable(input);

    const pocket = await kasPocketRepository.findById(input.kasPocketId);
    if (!pocket) throw new NotFoundError("Kas pocket tidak ditemukan");

    // Baris yang tidak pernah diisi tetap harus bisa dikonfirmasi: "Sesuai" pada baris
    // kosong = pernyataan bahwa saldonya memang nol. Entrinya dibuat di sini (balance 0)
    // supaya hasil verifikasi punya tempat menempel — sama seperti baris yang sudah berisi.
    const entry =
      (await kasDailyEntryRepository.findByPocketAndDate(input.kasPocketId, input.date)) ??
      (await kasDailyEntryRepository.upsert({
        kasPocketId: input.kasPocketId,
        date: input.date,
        balance: 0,
        createdBy: input.verifiedBy ?? null,
      }));

    return verifyEntry({
      entry,
      companyId: pocket.companyId,
      target: "KAS",
      ref: { kasPocketId: input.kasPocketId },
      targetLabel: pocket.name,
      input,
      markVerified: kasDailyEntryRepository.markVerified,
    });
  },

  verifyBank: async (input: VerifyInput & { bankAccountId: string }) => {
    assertVerifiable(input);

    const account = await bankAccountRepository.findById(input.bankAccountId);
    if (!account) throw new NotFoundError("Rekening tidak ditemukan");

    // Sama seperti kas: rekening yang belum diisi tetap bisa dikonfirmasi, entrinya
    // dibuat dengan saldo 0 supaya statusnya tersimpan.
    const entry =
      (await dailyBankEntryRepository.findByAccountAndDate(input.bankAccountId, input.date)) ??
      (await dailyBankEntryRepository.upsertOne({
        bankAccountId: input.bankAccountId,
        date: input.date,
        balance: 0,
        createdBy: input.verifiedBy ?? null,
      }));

    return verifyEntry({
      entry,
      companyId: account.companyId,
      target: "BANK",
      ref: { bankAccountId: input.bankAccountId },
      targetLabel: `${account.accountName} — ${account.bankName}`,
      input,
      markVerified: dailyBankEntryRepository.markVerified,
    });
  },
};
