import prisma from "@/lib/prisma";
import { Prisma, type HeldFundKind } from "@src/generated/prisma/client";

/**
 * Nama pencatat & pelunas selalu ikut terbawa. Kolomnya menyimpan userId, dan
 * userId tidak berarti apa-apa di layar — satu `select` bersama di sini membuat
 * setiap pemanggil mendapatkan namanya tanpa query susulan, dan tanpa ada yang
 * tergoda menyalin nama ke baris hutangnya (salinan itu basi begitu user-nya
 * ganti nama).
 */
const withActors = {
  createdByUser: { select: { id: true, name: true } },
  settledByUser: { select: { id: true, name: true } },
} as const;

/**
 * Dana Tertahan (hutang yang tertahan di kedua arah).
 *
 * `kind` memisahkan dua arah yang tidak boleh saling menutupi: CREDIT adalah
 * piutang (uang akan masuk), DEBIT adalah hutang perusahaan (uang akan keluar).
 *
 * Tiga pola baca yang harus dijaga tetap terpisah:
 *
 * • **Per tanggal** (`findByCompanyAndDate`) — grid input. Tanggal di sini
 *   adalah tanggal hutangnya dicatat, dan hasilnya boleh kosong.
 * • **Semua yang belum lunas** (`findOutstandingByCompany`) — daftar utama
 *   halaman. Lintas tanggal, karena hutang tidak berhenti hanya karena harinya
 *   berganti.
 * • **Rekap yang belum lunas** (`outstandingForCompany` / `outstandingReport`) —
 *   angka. Sebuah hutang tetap tertahan sampai dinyatakan lunas, jadi totalnya
 *   tidak pernah dihitung dari satu tanggal saja.
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
      include: withActors,
    });
  },

  /**
   * Seluruh hutang satu PT yang BELUM lunas, tanpa batas tanggal — inilah daftar
   * yang dipakai halaman untuk menjawab "siapa saja yang masih berhutang".
   *
   * Diurutkan dari yang paling tua supaya hutang yang menua tidak tenggelam di
   * bawah catatan hari ini; itu justru yang paling perlu ditagih.
   */
  findOutstandingByCompany(companyId: string, kind?: HeldFundKind) {
    return prisma.heldFund.findMany({
      where: { companyId, settledAt: null, ...(kind ? { kind } : {}) },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      include: withActors,
    });
  },

  create(data: {
    companyId: string;
    date: Date;
    kind: HeldFundKind;
    name: string;
    amount?: number;
    note?: string | null;
    createdBy?: string | null;
  }) {
    return prisma.heldFund.create({
      data: {
        companyId: data.companyId,
        date: data.date,
        kind: data.kind,
        name: data.name,
        amount: new Prisma.Decimal(data.amount ?? 0),
        note: data.note,
        createdBy: data.createdBy,
      },
      include: withActors,
    });
  },

  update(
    id: string,
    data: { name?: string; kind?: HeldFundKind; amount?: number; note?: string | null }
  ) {
    return prisma.heldFund.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.kind !== undefined ? { kind: data.kind } : {}),
        ...(data.amount !== undefined ? { amount: new Prisma.Decimal(data.amount) } : {}),
        ...(data.note !== undefined ? { note: data.note } : {}),
      },
      include: withActors,
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
      include: withActors,
    });
  },

  delete(id: string) {
    return prisma.heldFund.delete({ where: { id } });
  },

  /**
   * Total & jumlah baris yang belum lunas untuk satu PT, tanpa batas tanggal —
   * inilah "dana tertahan" yang dipakai badge halaman.
   *
   * Dipecah per arah karena penjumlahan mentahnya menyesatkan: piutang 10 juta
   * dan hutang 10 juta bukan "nol dana tertahan", melainkan dua kewajiban yang
   * sama-sama harus diselesaikan. `total` tetap disediakan sebagai jumlah baris
   * tertahan seluruhnya, bukan sebagai posisi bersih.
   */
  async outstandingForCompany(companyId: string) {
    const rows = await prisma.heldFund.groupBy({
      by: ["kind"],
      where: { companyId, settledAt: null },
      _sum: { amount: true },
      _count: { _all: true },
    });

    const empty = { total: 0, count: 0 };
    const summary = {
      credit: { ...empty },
      debit: { ...empty },
      ...empty,
    };
    for (const row of rows) {
      const bucket = row.kind === "DEBIT" ? summary.debit : summary.credit;
      bucket.total = Number(row._sum.amount ?? 0);
      bucket.count = row._count._all;
      summary.total += bucket.total;
      summary.count += bucket.count;
    }
    return summary;
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
   *
   * Hasilnya dipecah **per arah** (satu baris per companyId × kind), bukan satu
   * angka gabungan. Laporan memakainya untuk merekonsiliasi Saldo Fisik ke
   * Posisi Bersih — piutang menambah, hutang mengurangi — dan rekonsiliasi itu
   * mustahil dari angka yang sudah terlanjur dijumlahkan. PT tanpa baris sama
   * sekali tidak muncul di hasil; pemanggilnya yang memberi nilai nol.
   */
  outstandingReport(companyIds: string[], from: string, to: string) {
    if (companyIds.length === 0) return Promise.resolve<HeldFundReportRow[]>([]);
    const ids = Prisma.join(companyIds);
    return prisma.$queryRaw<HeldFundReportRow[]>`
      SELECT h."companyId"                                            AS "companyId",
             h."kind"::text                                           AS "kind",
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
      FROM "HeldFund" h
      WHERE h."companyId" IN (${ids})
      GROUP BY h."companyId", h."kind"
    `;
  },
};

/** Satu baris rekap Dana Tertahan per PT **per arah** untuk Laporan Finance. */
export type HeldFundReportRow = {
  companyId: string;
  kind: "CREDIT" | "DEBIT";
  /** Belum lunas pada akhir periode — posisi, bukan arus. */
  outstanding: number;
  outstandingCount: number;
  /** Cair sepanjang periode. */
  settledInRange: number;
  settledCount: number;
  /** Tercatat sepanjang periode, lunas maupun belum. */
  addedInRange: number;
};
