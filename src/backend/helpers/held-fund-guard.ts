import type { Authz } from "@/backend/helpers/authz";
import { ForbiddenError } from "@/backend/errors/app-error";
import { allowsCompany } from "@/lib/authz/resolve";
import { isPastDate } from "@/backend/helpers/date-only";

/**
 * Gerbang tanggal untuk **isi** dana tertahan (tambah / ubah nama & jumlah /
 * hapus). Aturannya sama dengan input harian lainnya: hari berjalan boleh diisi
 * siapa pun yang berhak menulis, tanggal lampau butuh `daily.backdate` untuk PT
 * itu.
 *
 * Sengaja TIDAK dipakai untuk pelunasan. Menandai lunas hutang minggu lalu
 * adalah alur normal modul ini — uangnya baru masuk hari ini — bukan pembetulan
 * angka lampau, jadi ia digerbangi `finance.receivable.settle` saja.
 */
export function assertHeldFundEditableDate(caller: Authz, companyId: string, date: Date) {
  if (!isPastDate(date)) return;
  if (!allowsCompany(caller.subject, "daily.backdate", "write", companyId)) {
    throw new ForbiddenError("Tanggal sudah lewat — ubah isi perlu izin ubah tanggal lampau");
  }
}
