import type { Authz } from "@/backend/helpers/authz";
import { ForbiddenError } from "@/backend/errors/app-error";
import { heldFundRepository } from "@/backend/repositories/held-fund.repository";
import { todayDateOnly } from "@/backend/helpers/date-only";

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

  const [rows, outstanding] = await Promise.all([
    heldFundRepository.findByCompanyAndDate(companyId, date),
    // Total tertahan sengaja LINTAS TANGGAL, bukan hanya tanggal yang dibuka:
    // hutang yang dicatat minggu lalu dan belum lunas tetap uang yang belum
    // masuk hari ini. Menghitungnya per tanggal akan membuat angkanya terlihat
    // nol setiap kali user membuka hari yang sepi.
    heldFundRepository.outstandingForCompany(companyId),
  ]);

  return {
    serverDate: todayDateOnly().toISOString().slice(0, 10),
    rows: rows.map((row) => ({
      id: row.id,
      name: row.name,
      amount: row.amount.toString(),
      note: row.note,
      settledAt: row.settledAt?.toISOString() ?? null,
    })),
    /** Posisi dana tertahan seluruh tanggal untuk PT ini. */
    outstanding,
    canInput: authz.canWrite(companyId),
  };
}

export type HeldFundPayload = Awaited<ReturnType<typeof buildHeldFundPayload>>;
