-- Cross-check kepala cabang: (1) bank ikut dikonfirmasi seperti kas, (2) nilai IDR stock
-- tidak lagi diisi per item melainkan satu total final untuk seluruh valas + logam mulia.

-- Nilai IDR per item tidak lagi diisi dari UI — baris baru dibiarkan NULL, baris lama tetap ada.
ALTER TABLE "StockistHeadConfirmation" ALTER COLUMN "confirmedIdrValue" DROP NOT NULL;

-- CreateTable
CREATE TABLE "StockistTotalHeadConfirmation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "confirmedIdrValue" DECIMAL(65,30) NOT NULL,
    "note" TEXT,
    "confirmedBy" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockistTotalHeadConfirmation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankHeadConfirmation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "confirmedIdrValue" DECIMAL(65,30) NOT NULL,
    "note" TEXT,
    "confirmedBy" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankHeadConfirmation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockistTotalHeadConfirmation_companyId_date_idx" ON "StockistTotalHeadConfirmation"("companyId", "date");
CREATE UNIQUE INDEX "StockistTotalHeadConfirmation_companyId_date_key" ON "StockistTotalHeadConfirmation"("companyId", "date");
CREATE INDEX "BankHeadConfirmation_companyId_date_idx" ON "BankHeadConfirmation"("companyId", "date");
CREATE UNIQUE INDEX "BankHeadConfirmation_companyId_date_key" ON "BankHeadConfirmation"("companyId", "date");

-- AddForeignKey
ALTER TABLE "StockistTotalHeadConfirmation" ADD CONSTRAINT "StockistTotalHeadConfirmation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BankHeadConfirmation" ADD CONSTRAINT "BankHeadConfirmation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: total IDR stock lama (jumlah per item) jadi satu baris total per PT per tanggal.
INSERT INTO "StockistTotalHeadConfirmation" ("id", "companyId", "date", "confirmedIdrValue", "note", "confirmedAt", "createdAt", "updatedAt")
SELECT
  MD5(shc."companyId" || '|' || shc.date::text),
  shc."companyId",
  shc.date,
  SUM(COALESCE(shc."confirmedIdrValue", 0)),
  'Migrasi otomatis dari total IDR per item',
  MAX(shc."confirmedAt"),
  NOW(),
  NOW()
FROM "StockistHeadConfirmation" shc
GROUP BY shc."companyId", shc.date
ON CONFLICT ("companyId", "date") DO NOTHING;

-- ================================================================
-- HERMES VIEWS — ikut menyesuaikan sumber angka IDR yang baru
-- ================================================================

-- Total IDR stock (final, satu angka per PT per tanggal) hasil hitung ulang kepala cabang.
CREATE OR REPLACE VIEW hv_stockist_total_head_confirmations AS
SELECT
  sthc.id,
  sthc."companyId"                                                       AS company_id,
  COALESCE(co.name, '')                                                  AS company_name,
  COALESCE(co.code, '')                                                  AS company_code,
  sthc.date,
  EXTRACT(YEAR  FROM sthc.date)::int                                     AS year,
  EXTRACT(MONTH FROM sthc.date)::int                                     AS month,
  TO_CHAR(sthc.date, 'YYYY-MM')                                          AS period_label,
  sthc."confirmedIdrValue"::numeric                                      AS confirmed_idr_value,
  COALESCE(sthc.note, '')                                                AS note,
  COALESCE(sthc."confirmedBy", '')                                       AS confirmed_by,
  sthc."confirmedAt"                                                     AS confirmed_at,
  sthc."createdAt"                                                       AS created_at,
  sthc."updatedAt"                                                       AS updated_at
FROM "StockistTotalHeadConfirmation" sthc
JOIN "Company" co ON co.id = sthc."companyId";

-- Per (PT, tanggal): total bank hasil hitung ulang kepala cabang vs. total sistem
-- (sum saldo harian semua rekening aktif PT itu pada tanggal tersebut).
CREATE OR REPLACE VIEW hv_bank_head_confirmations AS
SELECT
  bhc.id,
  bhc."companyId"                                                        AS company_id,
  COALESCE(co.name, '')                                                  AS company_name,
  COALESCE(co.code, '')                                                  AS company_code,
  bhc.date,
  EXTRACT(YEAR  FROM bhc.date)::int                                      AS year,
  EXTRACT(MONTH FROM bhc.date)::int                                      AS month,
  TO_CHAR(bhc.date, 'YYYY-MM')                                           AS period_label,
  COALESCE(sys.system_idr_value, 0)::numeric                             AS system_idr_value,
  bhc."confirmedIdrValue"::numeric                                       AS confirmed_idr_value,
  (bhc."confirmedIdrValue" - COALESCE(sys.system_idr_value, 0))::numeric AS selisih_idr_value,
  (bhc."confirmedIdrValue" - COALESCE(sys.system_idr_value, 0)) = 0      AS is_match,
  CASE
    WHEN (bhc."confirmedIdrValue" - COALESCE(sys.system_idr_value, 0)) = 0 THEN 'Cocok'
    ELSE 'Selisih'
  END                                                                    AS match_label,
  COALESCE(bhc.note, '')                                                 AS note,
  COALESCE(bhc."confirmedBy", '')                                        AS confirmed_by,
  bhc."confirmedAt"                                                      AS confirmed_at,
  bhc."createdAt"                                                        AS created_at,
  bhc."updatedAt"                                                        AS updated_at
FROM "BankHeadConfirmation" bhc
JOIN "Company" co ON co.id = bhc."companyId"
LEFT JOIN LATERAL (
  SELECT SUM(dbe.balance) AS system_idr_value
  FROM "DailyBankEntry" dbe
  JOIN "BankAccount" ba ON ba.id = dbe."bankAccountId"
  WHERE ba."companyId" = bhc."companyId"
    AND ba."isActive"
    AND dbe.date = bhc.date
) sys ON TRUE;

-- Rollup finance: sekarang stock diambil dari total final (bukan sum per item) dan bank ikut.
DROP VIEW IF EXISTS hv_finance_confirmed_daily;
CREATE VIEW hv_finance_confirmed_daily AS
SELECT
  cht.id,
  cht."companyId"                                                        AS company_id,
  COALESCE(co.name, '')                                                  AS company_name,
  COALESCE(co.code, '')                                                  AS company_code,
  cht.date,
  EXTRACT(YEAR  FROM cht.date)::int                                      AS year,
  EXTRACT(MONTH FROM cht.date)::int                                      AS month,
  TO_CHAR(cht.date, 'YYYY-MM')                                           AS period_label,
  COALESCE(stock."confirmedIdrValue", 0)::numeric                        AS stock_confirmed_idr,
  COALESCE(kas."confirmedIdrValue", 0)::numeric                          AS kas_confirmed_idr,
  COALESCE(bank."confirmedIdrValue", 0)::numeric                         AS bank_confirmed_idr,
  cht."totalIdr"::numeric                                                AS total_confirmed_idr,
  COALESCE(qty.items_confirmed, 0)                                       AS items_confirmed_count,
  COALESCE(active_items.active_item_count, 0)                            AS active_item_count,
  (COALESCE(qty.items_confirmed, 0) >= COALESCE(active_items.active_item_count, 0)
    AND stock."confirmedIdrValue" IS NOT NULL
    AND kas."confirmedIdrValue" IS NOT NULL
    AND bank."confirmedIdrValue" IS NOT NULL)                            AS is_fully_reconciled,
  CASE
    WHEN COALESCE(qty.items_confirmed, 0) >= COALESCE(active_items.active_item_count, 0)
     AND stock."confirmedIdrValue" IS NOT NULL
     AND kas."confirmedIdrValue" IS NOT NULL
     AND bank."confirmedIdrValue" IS NOT NULL THEN 'Lengkap'
    ELSE 'Belum Lengkap'
  END                                                                    AS reconciliation_status_label,
  CONCAT(
    COALESCE(co.name, 'PT tidak diketahui'), ' | ', TO_CHAR(cht.date, 'DD Mon YYYY'),
    ' | Total dikonfirmasi kepala cabang Rp ', TO_CHAR(cht."totalIdr", 'FM999,999,999'),
    ' (Stok Rp ', TO_CHAR(COALESCE(stock."confirmedIdrValue", 0), 'FM999,999,999'),
    ' + Kas Rp ', TO_CHAR(COALESCE(kas."confirmedIdrValue", 0), 'FM999,999,999'),
    ' + Bank Rp ', TO_CHAR(COALESCE(bank."confirmedIdrValue", 0), 'FM999,999,999'), ')'
  )                                                                      AS context_summary,
  cht."updatedAt"                                                        AS updated_at
FROM "CompanyHeadConfirmationTotal" cht
JOIN "Company" co ON co.id = cht."companyId"
LEFT JOIN "StockistTotalHeadConfirmation" stock
  ON stock."companyId" = cht."companyId" AND stock.date = cht.date
LEFT JOIN "KasHeadConfirmation" kas
  ON kas."companyId" = cht."companyId" AND kas.date = cht.date
LEFT JOIN "BankHeadConfirmation" bank
  ON bank."companyId" = cht."companyId" AND bank.date = cht.date
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS items_confirmed
  FROM "StockistHeadConfirmation" shc
  WHERE shc."companyId" = cht."companyId" AND shc.date = cht.date
) qty ON TRUE
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS active_item_count
  FROM "CompanyStockItem" csi
  WHERE csi."companyId" = cht."companyId" AND csi."isActive"
) active_items ON TRUE;

GRANT SELECT ON hv_stockist_total_head_confirmations TO oc_pvi_reader;
GRANT SELECT ON hv_bank_head_confirmations           TO oc_pvi_reader;
GRANT SELECT ON hv_finance_confirmed_daily           TO oc_pvi_reader;
