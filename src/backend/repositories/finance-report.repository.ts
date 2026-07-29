import prisma from "@/lib/prisma";
import { Prisma } from "@src/generated/prisma/client";

/**
 * Agregat lintas-PT untuk Laporan Finance.
 *
 * Semuanya ditulis sebagai satu query mentah per bentuk data, bukan sekumpulan
 * `findMany` per PT: DB-nya remote, jadi biaya sebenarnya ada di jumlah
 * round-trip, bukan di kompleksitas SQL-nya. Empat query di sini menggantikan
 * apa yang secara naif akan jadi puluhan (3 PT × 3 domain × N tanggal).
 *
 * Konvensi:
 * - Tanggal masuk & keluar sebagai string `YYYY-MM-DD` (`::date` di SQL,
 *   `to_char` di hasil) supaya tidak ada pergeseran hari akibat timezone driver.
 * - Kolom uang di-cast `::float8` supaya yang sampai ke JS berupa `number`,
 *   bukan `Decimal`/string yang bentuknya bergantung driver.
 */

export type ConfirmationKind = "STOCK" | "KAS" | "BANK";

/** Satu angka konfirmasi kepala cabang: 1 PT × 1 domain × 1 tanggal. */
export type ConfirmationRow = {
  kind: ConfirmationKind;
  companyId: string;
  date: string;
  amount: number;
};

/** Angka "menurut sistem" (hasil input harian) untuk dibandingkan dengan konfirmasi. */
export type SystemSumRow = {
  kind: "KAS" | "BANK";
  companyId: string;
  date: string;
  amount: number;
};

export type QualityRow = {
  kind: "STOCK" | "KAS" | "BANK" | "KOREKSI";
  companyId: string;
  status: string;
  count: number;
};

export type StockQtyRow = {
  companyId: string;
  companyStockItemId: string;
  date: string;
  qty: number;
};

export const financeReportRepository = {
  /**
   * Seluruh konfirmasi IDR (stock/kas/bank) milik `companyIds` dalam rentang.
   * Tiga tabel digabung UNION ALL karena bentuk barisnya identik dan pemanggil
   * memperlakukannya sebagai satu deret waktu berlabel.
   */
  confirmationsInRange: (companyIds: string[], from: string, to: string) => {
    if (companyIds.length === 0) return Promise.resolve<ConfirmationRow[]>([]);
    const ids = Prisma.join(companyIds);
    return prisma.$queryRaw<ConfirmationRow[]>`
      SELECT 'STOCK' AS "kind",
             "companyId",
             to_char("date", 'YYYY-MM-DD') AS "date",
             "confirmedIdrValue"::float8   AS "amount"
      FROM "StockistTotalHeadConfirmation"
      WHERE "companyId" IN (${ids}) AND "date" BETWEEN ${from}::date AND ${to}::date
      UNION ALL
      SELECT 'KAS',
             "companyId",
             to_char("date", 'YYYY-MM-DD'),
             "confirmedIdrValue"::float8
      FROM "KasHeadConfirmation"
      WHERE "companyId" IN (${ids}) AND "date" BETWEEN ${from}::date AND ${to}::date
      UNION ALL
      SELECT 'BANK',
             "companyId",
             to_char("date", 'YYYY-MM-DD'),
             "confirmedIdrValue"::float8
      FROM "BankHeadConfirmation"
      WHERE "companyId" IN (${ids}) AND "date" BETWEEN ${from}::date AND ${to}::date
      ORDER BY "date" ASC
    `;
  },

  /**
   * Posisi awal: konfirmasi terakhir per PT per domain *sebelum* `before`.
   *
   * Tanpa ini, PT yang tidak dikonfirmasi pada hari pertama periode akan terlihat
   * bersaldo nol — padahal saldo terakhirnya masih berlaku. `DISTINCT ON` memilih
   * satu baris terbaru per PT langsung di DB, bukan menarik seluruh riwayat.
   */
  openingPositions: (companyIds: string[], before: string) => {
    if (companyIds.length === 0) return Promise.resolve<ConfirmationRow[]>([]);
    const ids = Prisma.join(companyIds);
    return prisma.$queryRaw<ConfirmationRow[]>`
      (SELECT DISTINCT ON ("companyId")
              'STOCK' AS "kind",
              "companyId",
              to_char("date", 'YYYY-MM-DD') AS "date",
              "confirmedIdrValue"::float8   AS "amount"
       FROM "StockistTotalHeadConfirmation"
       WHERE "companyId" IN (${ids}) AND "date" < ${before}::date
       ORDER BY "companyId", "date" DESC)
      UNION ALL
      (SELECT DISTINCT ON ("companyId")
              'KAS',
              "companyId",
              to_char("date", 'YYYY-MM-DD'),
              "confirmedIdrValue"::float8
       FROM "KasHeadConfirmation"
       WHERE "companyId" IN (${ids}) AND "date" < ${before}::date
       ORDER BY "companyId", "date" DESC)
      UNION ALL
      (SELECT DISTINCT ON ("companyId")
              'BANK',
              "companyId",
              to_char("date", 'YYYY-MM-DD'),
              "confirmedIdrValue"::float8
       FROM "BankHeadConfirmation"
       WHERE "companyId" IN (${ids}) AND "date" < ${before}::date
       ORDER BY "companyId", "date" DESC)
    `;
  },

  /**
   * Total harian menurut sistem (input teller/marketing), untuk kolom selisih
   * cross-check. Cakupannya disamakan dengan
   * `stockist-head-confirmation.service.ts`: hanya pocket & rekening aktif.
   */
  systemSumsInRange: (companyIds: string[], from: string, to: string) => {
    if (companyIds.length === 0) return Promise.resolve<SystemSumRow[]>([]);
    const ids = Prisma.join(companyIds);
    return prisma.$queryRaw<SystemSumRow[]>`
      SELECT 'KAS' AS "kind",
             p."companyId"                    AS "companyId",
             to_char(e."date", 'YYYY-MM-DD')  AS "date",
             SUM(e."balance")::float8         AS "amount"
      FROM "KasDailyEntry" e
      JOIN "KasPocket" p ON p."id" = e."kasPocketId"
      WHERE p."companyId" IN (${ids})
        AND p."isActive" = true
        AND e."date" BETWEEN ${from}::date AND ${to}::date
      GROUP BY 1, 2, 3
      UNION ALL
      SELECT 'BANK',
             a."companyId",
             to_char(e."date", 'YYYY-MM-DD'),
             SUM(e."balance")::float8
      FROM "DailyBankEntry" e
      JOIN "BankAccount" a ON a."id" = e."bankAccountId"
      WHERE a."companyId" IN (${ids})
        AND a."isActive" = true
        AND e."date" BETWEEN ${from}::date AND ${to}::date
      GROUP BY 1, 2, 3
    `;
  },

  /**
   * Rekap kualitas data periode ini: sebaran status verifikasi H+1 untuk stock,
   * kas, dan bank, plus status pengajuan koreksi. Empat hitungan berbeda dalam
   * satu round-trip karena semuanya hanya dipakai sebagai angka ringkasan.
   */
  qualityCounts: (companyIds: string[], from: string, to: string) => {
    if (companyIds.length === 0) return Promise.resolve<QualityRow[]>([]);
    const ids = Prisma.join(companyIds);
    return prisma.$queryRaw<QualityRow[]>`
      SELECT 'STOCK' AS "kind",
             p."companyId"    AS "companyId",
             d."status"::text AS "status",
             COUNT(*)::int    AS "count"
      FROM "StockistDailyCheck" d
      JOIN "StockistPocket" p ON p."id" = d."pocketId"
      WHERE p."companyId" IN (${ids})
        AND p."isDefault" = false
        AND p."isActive" = true
        AND p."deletedAt" IS NULL
        AND d."date" BETWEEN ${from}::date AND ${to}::date
      GROUP BY 1, 2, 3
      UNION ALL
      SELECT 'KAS',
             p."companyId",
             e."verifyStatus"::text,
             COUNT(*)::int
      FROM "KasDailyEntry" e
      JOIN "KasPocket" p ON p."id" = e."kasPocketId"
      WHERE p."companyId" IN (${ids})
        AND p."isActive" = true
        AND e."date" BETWEEN ${from}::date AND ${to}::date
      GROUP BY 1, 2, 3
      UNION ALL
      SELECT 'BANK',
             a."companyId",
             e."verifyStatus"::text,
             COUNT(*)::int
      FROM "DailyBankEntry" e
      JOIN "BankAccount" a ON a."id" = e."bankAccountId"
      WHERE a."companyId" IN (${ids})
        AND a."isActive" = true
        AND e."date" BETWEEN ${from}::date AND ${to}::date
      GROUP BY 1, 2, 3
      UNION ALL
      SELECT 'KOREKSI',
             r."companyId",
             r."status"::text,
             COUNT(*)::int
      FROM "CorrectionRequest" r
      WHERE r."companyId" IN (${ids})
        AND r."date" BETWEEN ${from}::date AND ${to}::date
      GROUP BY 1, 2, 3
    `;
  },

  /**
   * Kuantitas stock penutup per item: hasil opname terakhir dalam rentang,
   * dijumlahkan lintas pocket. Agregasi + pemilihan tanggal terbaru dilakukan di
   * DB (`DISTINCT ON` di atas subquery ter-`GROUP BY`) supaya yang lewat kabel
   * hanya satu baris per item, bukan seluruh opname harian sepanjang periode.
   */
  closingStockQuantities: (companyIds: string[], from: string, to: string) => {
    if (companyIds.length === 0) return Promise.resolve<StockQtyRow[]>([]);
    const ids = Prisma.join(companyIds);
    return prisma.$queryRaw<StockQtyRow[]>`
      SELECT DISTINCT ON (x."companyId", x."companyStockItemId")
             x."companyId",
             x."companyStockItemId",
             x."date",
             x."qty"
      FROM (
        SELECT p."companyId"                      AS "companyId",
               d."companyStockItemId"             AS "companyStockItemId",
               to_char(d."date", 'YYYY-MM-DD')    AS "date",
               SUM(d."enteredQuantity")::float8   AS "qty"
        FROM "StockistDailyCheck" d
        JOIN "StockistPocket" p ON p."id" = d."pocketId"
        WHERE p."companyId" IN (${ids})
          AND p."isDefault" = false
          AND p."isActive" = true
          AND p."deletedAt" IS NULL
          AND d."enteredQuantity" IS NOT NULL
          AND d."date" BETWEEN ${from}::date AND ${to}::date
        GROUP BY 1, 2, 3
      ) x
      ORDER BY x."companyId", x."companyStockItemId", x."date" DESC
    `;
  },
};
