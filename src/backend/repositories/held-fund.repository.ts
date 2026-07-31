import prisma from "@/lib/prisma";
import { Prisma } from "@src/generated/prisma/client";

/**
 * Dana Tertahan (hutang orang ke perusahaan).
 *
 * Dua pola baca yang harus dijaga tetap terpisah:
 *
 * • **Per tanggal** (`findByCompanyAndDate`) — isi halaman. Tanggal di sini
 *   adalah tanggal hutangnya dicatat, dan hasilnya boleh kosong.
 * • **Yang belum lunas lintas tanggal** (`outstandingTotals`) — angka laporan.
 *   Sebuah hutang tetap tertahan sampai dinyatakan lunas, jadi totalnya tidak
 *   pernah dihitung dari satu tanggal saja.
 */
export const heldFundRepository = {
  findById(id: string) {
    return prisma.heldFund.findUnique({ where: { id } });
  },

  /** Seluruh baris satu PT pada satu tanggal. Kosong = hari itu memang tidak ada hutang. */
  findByCompanyAndDate(companyId: string, date: Date) {
    return prisma.heldFund.findMany({
      where: { companyId, date },
      orderBy: [{ createdAt: "asc" }],
    });
  },

  create(data: {
    companyId: string;
    date: Date;
    name: string;
    amount?: number;
    note?: string | null;
    createdBy?: string | null;
  }) {
    return prisma.heldFund.create({
      data: {
        companyId: data.companyId,
        date: data.date,
        name: data.name,
        amount: new Prisma.Decimal(data.amount ?? 0),
        note: data.note,
        createdBy: data.createdBy,
      },
    });
  },

  update(id: string, data: { name?: string; amount?: number; note?: string | null }) {
    return prisma.heldFund.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.amount !== undefined ? { amount: new Prisma.Decimal(data.amount) } : {}),
        ...(data.note !== undefined ? { note: data.note } : {}),
      },
    });
  },

  /**
   * Menandai lunas / membatalkannya. `settledAt` sekaligus jadi jejak waktunya,
   * jadi pembatalan wajib mengosongkan `settledBy` juga — kalau tidak, barisnya
   * menyisakan nama orang yang "melunasinya" padahal statusnya kembali tertahan.
   */
  setSettled(id: string, settled: boolean, userId: string | null) {
    return prisma.heldFund.update({
      where: { id },
      data: settled
        ? { settledAt: new Date(), settledBy: userId }
        : { settledAt: null, settledBy: null },
    });
  },

  delete(id: string) {
    return prisma.heldFund.delete({ where: { id } });
  },

  /**
   * Total & jumlah baris yang belum lunas untuk satu PT, tanpa batas tanggal —
   * inilah "dana tertahan" yang dipakai badge halaman.
   */
  async outstandingForCompany(companyId: string) {
    const result = await prisma.heldFund.aggregate({
      where: { companyId, settledAt: null },
      _sum: { amount: true },
      _count: { _all: true },
    });
    return {
      total: Number(result._sum.amount ?? 0),
      count: result._count._all,
    };
  },

  /**
   * Angka Dana Tertahan untuk Laporan Finance, per PT, dalam satu round-trip.
   *
   * `asOf` membuat laporan periode lampau tetap benar: yang dihitung adalah
   * hutang yang sudah tercatat sampai tanggal itu dan **belum lunas pada tanggal
   * itu** — bukan status hari ini. Tanpa perbandingan `settledAt > asOf`, laporan
   * bulan lalu akan ikut menghapus hutang yang baru dibayar minggu ini, sehingga
   * angka historisnya berubah setiap kali ada pelunasan baru.
   *
   * `settledInRange` dipisah karena menjawab pertanyaan lain: berapa yang benar-
   * benar cair sepanjang periode.
   */
  outstandingReport(companyIds: string[], from: string, to: string) {
    if (companyIds.length === 0) return Promise.resolve<HeldFundReportRow[]>([]);
    const ids = Prisma.join(companyIds);
    return prisma.$queryRaw<HeldFundReportRow[]>`
      SELECT c."id"                                                   AS "companyId",
             COALESCE(SUM(h."amount") FILTER (
               WHERE h."date" <= ${to}::date
                 AND (h."settledAt" IS NULL OR h."settledAt" >= (${to}::date + 1))
             ), 0)::float8                                            AS "outstanding",
             COUNT(h."id") FILTER (
               WHERE h."date" <= ${to}::date
                 AND (h."settledAt" IS NULL OR h."settledAt" >= (${to}::date + 1))
             )::int                                                   AS "outstandingCount",
             COALESCE(SUM(h."amount") FILTER (
               WHERE h."settledAt" >= ${from}::date
                 AND h."settledAt" < (${to}::date + 1)
             ), 0)::float8                                            AS "settledInRange",
             COUNT(h."id") FILTER (
               WHERE h."settledAt" >= ${from}::date
                 AND h."settledAt" < (${to}::date + 1)
             )::int                                                   AS "settledCount",
             COALESCE(SUM(h."amount") FILTER (
               WHERE h."date" BETWEEN ${from}::date AND ${to}::date
             ), 0)::float8                                            AS "addedInRange"
      FROM "Company" c
      LEFT JOIN "HeldFund" h ON h."companyId" = c."id"
      WHERE c."id" IN (${ids})
      GROUP BY c."id"
    `;
  },
};

/** Satu baris rekap Dana Tertahan per PT untuk Laporan Finance. */
export type HeldFundReportRow = {
  companyId: string;
  /** Belum lunas pada akhir periode — posisi, bukan arus. */
  outstanding: number;
  outstandingCount: number;
  /** Cair sepanjang periode. */
  settledInRange: number;
  settledCount: number;
  /** Tercatat sepanjang periode, lunas maupun belum. */
  addedInRange: number;
};
