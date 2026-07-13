-- ================================================================
-- HERMES VIEWS — Stockist & Kas modules
-- Adds oc_pvi_reader read-only coverage for the modules that shipped
-- without any hv_ views: StockistPocket/Balance/Mutation/DailyCheck,
-- CompanyStockItem, and KasPocket/KasDailyEntry.
--
-- "Total" pocket (StockistPocket.isDefault) is never written to
-- StockistBalance/StockistMutation (see stockist.service.ts) — it's
-- computed on the fly by the app. hv_stockist_stock_by_company gives
-- the same aggregate via SQL SUM so reporting doesn't need app logic.
-- ================================================================

-- ============================================================
-- 20. hv_company_stock_items
--     Stock item catalog (mata uang / logam mulia) per PT.
-- ============================================================
CREATE OR REPLACE VIEW hv_company_stock_items AS
SELECT
  csi.id,
  csi."companyId"                                                         AS company_id,
  COALESCE(co.name, '')                                                   AS company_name,
  COALESCE(co.code, '')                                                   AS company_code,
  csi.name                                                                AS item_name,
  COALESCE(csi.code, '')                                                  AS item_code,
  csi.type                                                                AS item_type,
  CASE csi.type
    WHEN 'CURRENCY'    THEN 'Mata Uang'
    WHEN 'LOGAM_MULIA' THEN 'Logam Mulia'
    ELSE csi.type::text
  END                                                                     AS item_type_label,
  csi."sortOrder"                                                         AS sort_order,
  csi."isActive"                                                          AS is_active,
  CASE WHEN csi."isActive" THEN 'Aktif' ELSE 'Tidak Aktif' END           AS status_label,
  csi."createdAt"                                                         AS created_at
FROM "CompanyStockItem" csi
JOIN "Company" co ON co.id = csi."companyId";


-- ============================================================
-- 21. hv_stockist_pockets
--     Pocket list per PT (Kas Kecil, Finance Blue, Kurir A, dst),
--     including the auto "Total" pocket flagged via is_total_pocket.
-- ============================================================
CREATE OR REPLACE VIEW hv_stockist_pockets AS
SELECT
  sp.id,
  sp."companyId"                                                          AS company_id,
  COALESCE(co.name, '')                                                   AS company_name,
  COALESCE(co.code, '')                                                   AS company_code,
  sp.name                                                                 AS pocket_name,
  COALESCE(sp.code, '')                                                   AS pocket_code,
  sp."isDefault"                                                          AS is_total_pocket,
  sp."isActive"                                                           AS is_active,
  CASE WHEN sp."isActive" THEN 'Aktif' ELSE 'Tidak Aktif' END            AS status_label,
  sp."sortOrder"                                                         AS sort_order,
  sp."createdAt"                                                         AS created_at
FROM "StockistPocket" sp
JOIN "Company" co ON co.id = sp."companyId"
WHERE sp."deletedAt" IS NULL;


-- ============================================================
-- 22. hv_stockist_balances
--     Current balance matrix: pocket x stock item.
--     Total pocket never appears here (never persisted by the app).
-- ============================================================
CREATE OR REPLACE VIEW hv_stockist_balances AS
SELECT
  sb.id,
  sp.id                                                                   AS pocket_id,
  sp.name                                                                 AS pocket_name,
  sp."companyId"                                                          AS company_id,
  COALESCE(co.name, '')                                                   AS company_name,
  COALESCE(co.code, '')                                                   AS company_code,
  csi.id                                                                  AS stock_item_id,
  csi.name                                                                AS stock_item_name,
  csi.type                                                                AS stock_item_type,
  CASE csi.type
    WHEN 'CURRENCY'    THEN 'Mata Uang'
    WHEN 'LOGAM_MULIA' THEN 'Logam Mulia'
    ELSE csi.type::text
  END                                                                     AS stock_item_type_label,
  sb.quantity::numeric                                                    AS quantity,
  sb."updatedAt"                                                          AS updated_at
FROM "StockistBalance" sb
JOIN "StockistPocket" sp     ON sp.id = sb."pocketId"
JOIN "CompanyStockItem" csi  ON csi.id = sb."companyStockItemId"
JOIN "Company" co            ON co.id = sp."companyId"
WHERE sp."deletedAt" IS NULL;


-- ============================================================
-- 23. hv_stockist_stock_by_company
--     Stockist stock totals per PT per item — SQL equivalent of the
--     app's on-the-fly "Total" pocket (real pockets only, summed).
-- ============================================================
CREATE OR REPLACE VIEW hv_stockist_stock_by_company AS
SELECT
  sp."companyId"                                                          AS company_id,
  COALESCE(co.name, '')                                                   AS company_name,
  COALESCE(co.code, '')                                                   AS company_code,
  csi.id                                                                  AS stock_item_id,
  csi.name                                                                AS stock_item_name,
  csi.type                                                                AS stock_item_type,
  CASE csi.type
    WHEN 'CURRENCY'    THEN 'Mata Uang'
    WHEN 'LOGAM_MULIA' THEN 'Logam Mulia'
    ELSE csi.type::text
  END                                                                     AS stock_item_type_label,
  COUNT(sb.id)                                                            AS pocket_count,
  SUM(sb.quantity)::numeric                                               AS total_quantity
FROM "StockistBalance" sb
JOIN "StockistPocket" sp    ON sp.id = sb."pocketId"
JOIN "CompanyStockItem" csi ON csi.id = sb."companyStockItemId"
JOIN "Company" co           ON co.id = sp."companyId"
WHERE sp."deletedAt" IS NULL AND NOT sp."isDefault"
GROUP BY sp."companyId", co.name, co.code, csi.id, csi.name, csi.type;


-- ============================================================
-- 24. hv_stockist_mutations
--     Stockist pocket mutation history (top up, withdrawal, transfer,
--     adjustment) with full org + item context.
-- ============================================================
CREATE OR REPLACE VIEW hv_stockist_mutations AS
SELECT
  sm.id,
  sm."pocketId"                                                           AS pocket_id,
  sp.name                                                                 AS pocket_name,
  sp."companyId"                                                          AS company_id,
  COALESCE(co.name, '')                                                   AS company_name,
  COALESCE(co.code, '')                                                   AS company_code,
  csi.id                                                                  AS stock_item_id,
  csi.name                                                                AS stock_item_name,
  csi.type                                                                AS stock_item_type,
  sm.type                                                                 AS mutation_type,
  CASE sm.type
    WHEN 'OPENING'      THEN 'Saldo Awal'
    WHEN 'TOP_UP'       THEN 'Top Up'
    WHEN 'WITHDRAWAL'   THEN 'Penarikan'
    WHEN 'TRANSFER_IN'  THEN 'Transfer Masuk'
    WHEN 'TRANSFER_OUT' THEN 'Transfer Keluar'
    WHEN 'ADJUSTMENT'   THEN 'Koreksi'
    ELSE sm.type::text
  END                                                                     AS mutation_type_label,
  sm.quantity::numeric                                                    AS quantity,
  sm."balanceAfter"::numeric                                              AS balance_after,
  COALESCE(sm.note, '')                                                   AS note,
  COALESCE(sm."createdBy", '')                                            AS created_by,
  sm."createdAt"                                                          AS created_at,
  EXTRACT(YEAR  FROM sm."createdAt")::int                                 AS year,
  EXTRACT(MONTH FROM sm."createdAt")::int                                 AS month,
  TO_CHAR(sm."createdAt", 'YYYY-MM')                                      AS period_label
FROM "StockistMutation" sm
JOIN "StockistPocket" sp    ON sp.id = sm."pocketId"
JOIN "CompanyStockItem" csi ON csi.id = sm."companyStockItemId"
JOIN "Company" co           ON co.id = sp."companyId";


-- ============================================================
-- 25. hv_stockist_daily_checks
--     Daily opname (physical check) status per pocket per item.
-- ============================================================
CREATE OR REPLACE VIEW hv_stockist_daily_checks AS
SELECT
  sdc.id,
  sdc."pocketId"                                                          AS pocket_id,
  sp.name                                                                 AS pocket_name,
  sp."companyId"                                                          AS company_id,
  COALESCE(co.name, '')                                                   AS company_name,
  COALESCE(co.code, '')                                                   AS company_code,
  csi.id                                                                  AS stock_item_id,
  csi.name                                                                AS stock_item_name,
  sdc.date,
  EXTRACT(YEAR  FROM sdc.date)::int                                       AS year,
  EXTRACT(MONTH FROM sdc.date)::int                                       AS month,
  TO_CHAR(sdc.date, 'YYYY-MM')                                            AS period_label,
  sdc.status,
  CASE sdc.status
    WHEN 'BELUM_REVIEW' THEN 'Belum Direview'
    WHEN 'BEDA'         THEN 'Beda'
    WHEN 'BENAR'        THEN 'Benar'
    ELSE sdc.status::text
  END                                                                     AS status_label,
  sdc."enteredQuantity"::numeric                                          AS entered_quantity,
  sdc."filledAt"                                                          AS filled_at,
  COALESCE(sdc."filledBy", '')                                            AS filled_by,
  COALESCE(sdc.note, '')                                                  AS note,
  COALESCE(sdc."reviewedBy", '')                                          AS reviewed_by,
  sdc."reviewedAt"                                                        AS reviewed_at,
  sdc."createdAt"                                                         AS created_at
FROM "StockistDailyCheck" sdc
JOIN "StockistPocket" sp    ON sp.id = sdc."pocketId"
JOIN "CompanyStockItem" csi ON csi.id = sdc."companyStockItemId"
JOIN "Company" co           ON co.id = sp."companyId";


-- ============================================================
-- 26. hv_kas_pockets
--     Cash (rupiah) pocket list per PT — separate catalog from
--     StockistPocket.
-- ============================================================
CREATE OR REPLACE VIEW hv_kas_pockets AS
SELECT
  kp.id,
  kp."companyId"                                                          AS company_id,
  COALESCE(co.name, '')                                                   AS company_name,
  COALESCE(co.code, '')                                                   AS company_code,
  kp.name                                                                 AS pocket_name,
  COALESCE(kp.code, '')                                                   AS pocket_code,
  kp."isActive"                                                           AS is_active,
  CASE WHEN kp."isActive" THEN 'Aktif' ELSE 'Tidak Aktif' END            AS status_label,
  kp."sortOrder"                                                          AS sort_order,
  kp."createdAt"                                                          AS created_at
FROM "KasPocket" kp
JOIN "Company" co ON co.id = kp."companyId";


-- ============================================================
-- 27. hv_kas_daily
--     Daily cash balance entries per kas pocket.
-- ============================================================
CREATE OR REPLACE VIEW hv_kas_daily AS
SELECT
  kde.id,
  kde."kasPocketId"                                                       AS kas_pocket_id,
  kp.name                                                                 AS pocket_name,
  kp."companyId"                                                          AS company_id,
  COALESCE(co.name, '')                                                   AS company_name,
  COALESCE(co.code, '')                                                   AS company_code,
  kde.date,
  EXTRACT(YEAR  FROM kde.date)::int                                       AS year,
  EXTRACT(MONTH FROM kde.date)::int                                       AS month,
  TO_CHAR(kde.date, 'YYYY-MM')                                            AS period_label,
  kde.balance::numeric                                                    AS balance,
  COALESCE(kde.note, '')                                                  AS note,
  COALESCE(kde."createdBy", '')                                           AS created_by,
  kde."createdAt"                                                         AS created_at
FROM "KasDailyEntry" kde
JOIN "KasPocket" kp ON kp.id = kde."kasPocketId"
JOIN "Company"   co ON co.id = kp."companyId";


-- ============================================================
-- 28. hv_kas_balance_by_company
--     Latest cash balance per pocket, summed per PT — treasury
--     snapshot to sit alongside hv_bank_balance_by_company.
-- ============================================================
CREATE OR REPLACE VIEW hv_kas_balance_by_company AS
WITH latest AS (
  SELECT DISTINCT ON (kde."kasPocketId")
    kde."kasPocketId", kde.balance, kde.date
  FROM "KasDailyEntry" kde
  ORDER BY kde."kasPocketId", kde.date DESC
)
SELECT
  kp."companyId"                                                          AS company_id,
  COALESCE(co.name, '')                                                   AS company_name,
  COALESCE(co.code, '')                                                   AS company_code,
  COUNT(kp.id) FILTER (WHERE kp."isActive")                              AS active_pocket_count,
  COUNT(kp.id)                                                            AS total_pocket_count,
  COALESCE(SUM(latest.balance), 0)::numeric                              AS total_balance,
  MAX(latest.date)                                                        AS as_of_date
FROM "KasPocket" kp
LEFT JOIN latest ON latest."kasPocketId" = kp.id
JOIN "Company" co ON co.id = kp."companyId"
GROUP BY kp."companyId", co.name, co.code;


-- ================================================================
-- GRANT SELECT on the new hv_ views to oc_pvi_reader
-- ================================================================
GRANT SELECT ON hv_company_stock_items         TO oc_pvi_reader;
GRANT SELECT ON hv_stockist_pockets            TO oc_pvi_reader;
GRANT SELECT ON hv_stockist_balances           TO oc_pvi_reader;
GRANT SELECT ON hv_stockist_stock_by_company   TO oc_pvi_reader;
GRANT SELECT ON hv_stockist_mutations          TO oc_pvi_reader;
GRANT SELECT ON hv_stockist_daily_checks       TO oc_pvi_reader;
GRANT SELECT ON hv_kas_pockets                 TO oc_pvi_reader;
GRANT SELECT ON hv_kas_daily                   TO oc_pvi_reader;
GRANT SELECT ON hv_kas_balance_by_company      TO oc_pvi_reader;
