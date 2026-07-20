-- Catatan (note) bukan input manual duplikat seperti tarikCek — dikembalikan.
-- tarikCek tetap dihapus permanen sesuai instruksi.
DROP VIEW IF EXISTS "hv_bank_daily";

ALTER TABLE "DailyBankEntry" ADD COLUMN "note" TEXT;

CREATE OR REPLACE VIEW hv_bank_daily AS
SELECT
  dbe.id,
  dbe."bankAccountId"                                                     AS bank_account_id,
  ba."bankName"                                                           AS bank_name,
  ba."accountName"                                                        AS account_name,
  ba."companyId"                                                          AS company_id,
  COALESCE(co.name, '')                                                   AS company_name,
  COALESCE(co.code, '')                                                   AS company_code,
  cur.code                                                                AS currency_code,
  COALESCE(cur.symbol, cur.code)                                          AS currency_symbol,
  dbe.date,
  EXTRACT(YEAR  FROM dbe.date)::int                                       AS year,
  EXTRACT(MONTH FROM dbe.date)::int                                       AS month,
  TO_CHAR(dbe.date, 'YYYY-MM')                                            AS period_label,
  dbe.balance::numeric                                                    AS balance,
  COALESCE(dbe.note, '')                                                  AS note,
  COALESCE(dbe."createdBy", '')                                           AS created_by,
  dbe."createdAt"                                                         AS created_at
FROM "DailyBankEntry" dbe
JOIN  "BankAccount" ba  ON ba.id = dbe."bankAccountId"
JOIN  "Company"     co  ON co.id = ba."companyId"
JOIN  "Currency"    cur ON cur.id = ba."currencyId";

GRANT SELECT ON hv_bank_daily TO oc_pvi_reader;
