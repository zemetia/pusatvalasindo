import type { Authz } from "@/backend/helpers/authz";
import { ForbiddenError } from "@/backend/errors/app-error";
import { heldFundRepository } from "@/backend/repositories/held-fund.repository";
import { todayDateOnly } from "@/backend/helpers/date-only";
import type { HeldFund, HeldFundKind } from "@src/generated/prisma/client";

/** Baris hutang beserta nama pencatat & pelunasnya, apa adanya untuk klien. */
type RowWithActors = HeldFund & {
  createdByUser: { id: string; name: string } | null;
  settledByUser: { id: string; name: string } | null;
};

/**
 * Satu bentuk baris untuk SEMUA jalur (grid tanggal, daftar belum lunas, hasil
 * POST/PATCH). Kalau tiap endpoint memetakan sendiri, cepat atau lambat salah
 * satunya lupa mengirim `kind` atau `createdByName` dan barisnya kehilangan
 * arah/pencatat begitu selesai disimpan — persis field yang paling terlihat.
 */
export function toHeldFundRow(row: RowWithActors) {
  return {
    id: row.id,
    date: row.date.toISOString().slice(0, 10),
    kind: row.kind,
    name: row.name,
    amount: row.amount.toString(),
    note: row.note,
    settledAt: row.settledAt?.toISOString() ?? null,
    /** userId tidak berarti apa-apa di layar; namanya yang dibaca orang. */
    createdByName: row.createdByUser?.name ?? null,
    settledByName: row.settledByUser?.name ?? null,
  };
}

export type HeldFundRow = ReturnType<typeof toHeldFundRow>;
export type { HeldFundKind };

/**
 * Payload lengkap halaman Dana Tertahan, dipakai bersama oleh
 * `GET /api/dana-tertahan` dan halaman yang dirender server (`initialRows`) —
 * satu sumber kebenaran, jadi keduanya mustahil berbeda bentuk. Alasannya sama
 * seperti `bank-harian.service`: DB-nya remote, jadi fetch pertama setelah
 * hydrate adalah satu perjalanan browser → function → database yang bisa
 * dihilangkan.
 *
 * Menegakkan scope PT si pemanggil sendiri — jangan dipanggil dengan companyId
 * yang belum divalidasi.
 */
export async function buildHeldFundPayload(authz: Authz, companyId: string, date: Date) {
  if (!authz.canView(companyId)) {
    throw new ForbiddenError("Tidak punya akses ke PT ini");
  }

  const [rows, outstandingRows, outstanding] = await Promise.all([
    heldFundRepository.findByCompanyAndDate(companyId, date),
    // Daftar utama halaman: SELURUH hutang yang belum lunas, credit maupun
    // debit, lintas tanggal. Hutang tidak berhenti hanya karena harinya
    // berganti, jadi daftar yang tersaring per tanggal akan menyembunyikan
    // justru yang paling perlu ditagih — yang sudah lama menggantung.
    heldFundRepository.findOutstandingByCompany(companyId),
    // Total tertahan sengaja LINTAS TANGGAL, bukan hanya tanggal yang dibuka:
    // hutang yang dicatat minggu lalu dan belum lunas tetap uang yang belum
    // masuk hari ini. Menghitungnya per tanggal akan membuat angkanya terlihat
    // nol setiap kali user membuka hari yang sepi.
    heldFundRepository.outstandingForCompany(companyId),
  ]);

  return {
    serverDate: todayDateOnly().toISOString().slice(0, 10),
    /** Baris pada tanggal yang sedang dibuka — termasuk yang sudah lunas. */
    rows: rows.map(toHeldFundRow),
    /** Semua yang belum lunas, lintas tanggal, credit & debit. */
    outstandingRows: outstandingRows.map(toHeldFundRow),
    /** Posisi dana tertahan seluruh tanggal untuk PT ini, dipecah per arah. */
    outstanding,
    canInput: authz.canWrite(companyId),
  };
}

export type HeldFundPayload = Awaited<ReturnType<typeof buildHeldFundPayload>>;
