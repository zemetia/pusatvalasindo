-- ================================================================
-- HERMES VIEWS — Kepala Cabang cross-check confirmation
-- Exposes the reconciled (kepala cabang re-counted) stock/kas/finance
-- totals — the "mature", finance-ready numbers — alongside the raw
-- teller/marketing system totals so a selisih (variance) is visible
-- without any app-side logic. Mirrors the comparison already computed
-- in stockist-head-confirmation.service.ts (getStockConfirmationGrid /
-- getKasConfirmation), done here in SQL for read-only reporting.
-- ================================================================

-- ============================================================
-- 29. hv_stockist_head_confirmations
--     Per (PT, stock item, date): kepala cabang's confirmed count vs.
--     the system total (sum of non-default pocket opname entries for
--     that item/date). selisih_quantity = confirmed - system.
-- ============================================================
CREATE OR REPLACE VIEW hv_stockist_head_confirmations AS
SELECT
  shc.id,
  shc."companyId"                                                         AS company_id,
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
  shc.date,
  EXTRACT(YEAR  FROM shc.date)::int                                       AS year,
  EXTRACT(MONTH FROM shc.date)::int                                       AS month,
  TO_CHAR(shc.date, 'YYYY-MM')                                            AS period_label,
  COALESCE(sys.system_quantity, 0)::numeric                               AS system_quantity,
  shc."confirmedQuantity"::numeric                                        AS confirmed_quantity,
  shc."confirmedIdrValue"::numeric                                        AS confirmed_idr_value,
  (shc."confirmedQuantity" - COALESCE(sys.system_quantity, 0))::numeric   AS selisih_quantity,
  (shc."confirmedQuantity" - COALESCE(sys.system_quantity, 0)) = 0        AS is_match,
  CASE
    WHEN (shc."confirmedQuantity" - COALESCE(sys.system_quantity, 0)) = 0 THEN 'Cocok'
    ELSE 'Selisih'
  END                                                                     AS match_label,
  COALESCE(shc.note, '')                                                  AS note,
  COALESCE(shc."confirmedBy", '')                                        AS confirmed_by,
  shc."confirmedAt"                                                       AS confirmed_at,
  shc."createdAt"                                                        AS created_at,
  shc."updatedAt"                                                        AS updated_at
FROM "StockistHeadConfirmation" shc
JOIN "Company" co           ON co.id = shc."companyId"
JOIN "CompanyStockItem" csi ON csi.id = shc."companyStockItemId"
LEFT JOIN LATERAL (
  SELECT SUM(sdc."enteredQuantity") AS system_quantity
  FROM "StockistDailyCheck" sdc
  JOIN "StockistPocket" sp ON sp.id = sdc."pocketId"
  WHERE sp."companyId" = shc."companyId"
    AND sp."deletedAt" IS NULL
    AND NOT sp."isDefault"
    AND sdc."companyStockItemId" = shc."companyStockItemId"
    AND sdc.date = shc.date
    AND sdc."enteredQuantity" IS NOT NULL
) sys ON TRUE;


-- ============================================================
-- 30. hv_kas_head_confirmations
--     Per (PT, date): kepala cabang's confirmed cash total vs. the
--     system total (sum of that PT's kas pocket daily entries).
-- ============================================================
CREATE OR REPLACE VIEW hv_kas_head_confirmations AS
SELECT
  khc.id,
  khc."companyId"                                                         AS company_id,
  COALESCE(co.name, '')                                                   AS company_name,
  COALESCE(co.code, '')                                                   AS company_code,
  khc.date,
  EXTRACT(YEAR  FROM khc.date)::int                                       AS year,
  EXTRACT(MONTH FROM khc.date)::int                                       AS month,
  TO_CHAR(khc.date, 'YYYY-MM')                                            AS period_label,
  COALESCE(sys.system_idr_value, 0)::numeric                              AS system_idr_value,
  khc."confirmedIdrValue"::numeric                                        AS confirmed_idr_value,
  (khc."confirmedIdrValue" - COALESCE(sys.system_idr_value, 0))::numeric  AS selisih_idr_value,
  (khc."confirmedIdrValue" - COALESCE(sys.system_idr_value, 0)) = 0       AS is_match,
  CASE
    WHEN (khc."confirmedIdrValue" - COALESCE(sys.system_idr_value, 0)) = 0 THEN 'Cocok'
    ELSE 'Selisih'
  END                                                                     AS match_label,
  COALESCE(khc.note, '')                                                  AS note,
  COALESCE(khc."confirmedBy", '')                                        AS confirmed_by,
  khc."confirmedAt"                                                       AS confirmed_at,
  khc."createdAt"                                                        AS created_at,
  khc."updatedAt"                                                        AS updated_at
FROM "KasHeadConfirmation" khc
JOIN "Company" co ON co.id = khc."companyId"
LEFT JOIN LATERAL (
  SELECT SUM(kde.balance) AS system_idr_value
  FROM "KasDailyEntry" kde
  JOIN "KasPocket" kp ON kp.id = kde."kasPocketId"
  WHERE kp."companyId" = khc."companyId"
    AND kde.date = khc.date
) sys ON TRUE;


-- ============================================================
-- 31. hv_finance_confirmed_daily
--     The finance-ready daily rollup: kepala cabang's confirmed stock
--     + kas totals per PT per day (CompanyHeadConfirmationTotal), plus
--     a completeness flag so consumers can tell a "matang" (fully
--     reconciled) day from a partial one. This is the number finance
--     should treat as authoritative, over the raw teller/marketing
--     system totals in hv_stockist_stock_by_company / hv_kas_balance_by_company.
-- ============================================================
CREATE OR REPLACE VIEW hv_finance_confirmed_daily AS
SELECT
  cht.id,
  cht."companyId"                                                         AS company_id,
  COALESCE(co.name, '')                                                   AS company_name,
  COALESCE(co.code, '')                                                   AS company_code,
  cht.date,
  EXTRACT(YEAR  FROM cht.date)::int                                       AS year,
  EXTRACT(MONTH FROM cht.date)::int                                       AS month,
  TO_CHAR(cht.date, 'YYYY-MM')                                            AS period_label,
  COALESCE(stock.stock_confirmed_idr, 0)::numeric                         AS stock_confirmed_idr,
  COALESCE(kas."confirmedIdrValue", 0)::numeric                           AS kas_confirmed_idr,
  cht."totalIdr"::numeric                                                 AS total_confirmed_idr,
  COALESCE(stock.items_confirmed, 0)                                      AS items_confirmed_count,
  COALESCE(active_items.active_item_count, 0)                             AS active_item_count,
  (COALESCE(stock.items_confirmed, 0) >= COALESCE(active_items.active_item_count, 0)
    AND kas."confirmedIdrValue" IS NOT NULL)                              AS is_fully_reconciled,
  CASE
    WHEN COALESCE(stock.items_confirmed, 0) >= COALESCE(active_items.active_item_count, 0)
     AND kas."confirmedIdrValue" IS NOT NULL THEN 'Lengkap'
    ELSE 'Belum Lengkap'
  END                                                                     AS reconciliation_status_label,
  CONCAT(
    COALESCE(co.name, 'PT tidak diketahui'), ' | ', TO_CHAR(cht.date, 'DD Mon YYYY'),
    ' | Total dikonfirmasi kepala cabang Rp ', TO_CHAR(cht."totalIdr", 'FM999,999,999'),
    ' (Stok Rp ', TO_CHAR(COALESCE(stock.stock_confirmed_idr, 0), 'FM999,999,999'),
    ' + Kas Rp ', TO_CHAR(COALESCE(kas."confirmedIdrValue", 0), 'FM999,999,999'), ')'
  )                                                                       AS context_summary,
  cht."updatedAt"                                                        AS updated_at
FROM "CompanyHeadConfirmationTotal" cht
JOIN "Company" co ON co.id = cht."companyId"
LEFT JOIN "KasHeadConfirmation" kas
  ON kas."companyId" = cht."companyId" AND kas.date = cht.date
LEFT JOIN LATERAL (
  SELECT SUM(shc."confirmedIdrValue") AS stock_confirmed_idr,
         COUNT(*)                     AS items_confirmed
  FROM "StockistHeadConfirmation" shc
  WHERE shc."companyId" = cht."companyId" AND shc.date = cht.date
) stock ON TRUE
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS active_item_count
  FROM "CompanyStockItem" csi
  WHERE csi."companyId" = cht."companyId" AND csi."isActive"
) active_items ON TRUE;


-- ================================================================
-- GRANT SELECT on the new hv_ views to oc_pvi_reader
-- ================================================================
GRANT SELECT ON hv_stockist_head_confirmations  TO oc_pvi_reader;
GRANT SELECT ON hv_kas_head_confirmations       TO oc_pvi_reader;
GRANT SELECT ON hv_finance_confirmed_daily      TO oc_pvi_reader;
