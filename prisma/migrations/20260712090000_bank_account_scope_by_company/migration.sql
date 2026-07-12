-- Bank Harian scope change: BankAccount moves from per-branch to per-PT (Company),
-- matching Stockist/Kas/CompanyStockItem. Branches under the same company (e.g.
-- Cengkareng + Tangerang both under PVI) previously each had their own copy of the
-- same bank accounts; this migration merges those duplicates into one row per
-- company, summing balances and daily-entry balances on date conflicts.

-- 1. Add companyId (nullable first, backfilled below)
ALTER TABLE "BankAccount" ADD COLUMN "companyId" TEXT;

UPDATE "BankAccount" ba
SET "companyId" = b."companyId"
FROM "Branch" b
WHERE ba."branchId" = b."id";

-- 2. Canonical account per (companyId, bankName, accountNumber, accountName) group —
--    lowest id in the group wins, duplicates get merged into it.
CREATE TEMP TABLE "_bank_account_canonical" AS
SELECT
  "id",
  MIN("id") OVER (
    PARTITION BY "companyId", "bankName", COALESCE("accountNumber", ''), "accountName"
  ) AS "canonicalId"
FROM "BankAccount";

-- 3. Merge DailyBankEntry: repoint to canonical; on same-date conflict, sum balance
--    and tarikCek, concatenate notes, drop the duplicate row.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT dbe.*, c."canonicalId"
    FROM "DailyBankEntry" dbe
    JOIN "_bank_account_canonical" c ON c."id" = dbe."bankAccountId"
    WHERE c."canonicalId" <> dbe."bankAccountId"
  LOOP
    IF EXISTS (
      SELECT 1 FROM "DailyBankEntry"
      WHERE "bankAccountId" = r."canonicalId" AND "date" = r."date"
    ) THEN
      UPDATE "DailyBankEntry" tgt
      SET "balance" = tgt."balance" + r."balance",
          "tarikCek" = tgt."tarikCek" + r."tarikCek",
          "note" = NULLIF(TRIM(BOTH ' ' FROM CONCAT_WS(' | ', tgt."note", r."note")), '')
      WHERE tgt."bankAccountId" = r."canonicalId" AND tgt."date" = r."date";

      DELETE FROM "DailyBankEntry" WHERE "id" = r."id";
    ELSE
      UPDATE "DailyBankEntry" SET "bankAccountId" = r."canonicalId" WHERE "id" = r."id";
    END IF;
  END LOOP;
END $$;

-- 4. Repoint BankMutation history to canonical (no uniqueness constraint, safe as-is)
UPDATE "BankMutation" bm
SET "bankAccountId" = c."canonicalId"
FROM "_bank_account_canonical" c
WHERE bm."bankAccountId" = c."id" AND c."canonicalId" <> c."id";

-- 5. Sum balances into the canonical account
UPDATE "BankAccount" ba
SET "balance" = sub."total"
FROM (
  SELECT c2."canonicalId", SUM(ba2."balance") AS "total"
  FROM "BankAccount" ba2
  JOIN "_bank_account_canonical" c2 ON c2."id" = ba2."id"
  GROUP BY c2."canonicalId"
) sub
WHERE ba."id" = sub."canonicalId";

-- 6. Drop the merged-away duplicate accounts
DELETE FROM "BankAccount" ba
USING "_bank_account_canonical" c
WHERE ba."id" = c."id" AND c."canonicalId" <> c."id";

DROP TABLE "_bank_account_canonical";

-- 7. Enforce NOT NULL now that every remaining row has a companyId
ALTER TABLE "BankAccount" ALTER COLUMN "companyId" SET NOT NULL;

-- 8. Hermes reporting views (hv_bank_*) key off BankAccount.branchId — drop them so the
--    column can be dropped, then recreate below joining Company directly (no more Branch hop).
DROP VIEW IF EXISTS "hv_bank_accounts";
DROP VIEW IF EXISTS "hv_bank_balance_by_company";
DROP VIEW IF EXISTS "hv_bank_daily";
DROP VIEW IF EXISTS "hv_bank_mutations";

-- 9. Drop the old branch relation
ALTER TABLE "BankAccount" DROP CONSTRAINT "BankAccount_branchId_fkey";
ALTER TABLE "BankAccount" DROP COLUMN "branchId";

-- 10. Add the new company relation + index
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "BankAccount_companyId_idx" ON "BankAccount"("companyId");

-- 11. Recreate hv_bank_* views scoped by Company directly (branch_id/branch_name columns
--     removed — a bank account no longer belongs to a single branch).
CREATE OR REPLACE VIEW hv_bank_accounts AS
SELECT
  ba.id,
  ba."bankName"                                                           AS bank_name,
  COALESCE(ba."accountNumber", '')                                        AS account_number,
  ba."accountName"                                                        AS account_name,
  ba.balance::numeric                                                     AS current_balance,
  ba."isActive"                                                           AS is_active,
  CASE WHEN ba."isActive" THEN 'Aktif' ELSE 'Tidak Aktif' END            AS status_label,
  COALESCE(ba.note, '')                                                   AS note,
  ba."sortOrder"                                                          AS sort_order,
  ba."companyId"                                                          AS company_id,
  COALESCE(co.name, '')                                                   AS company_name,
  COALESCE(co.code, '')                                                   AS company_code,
  cur.code                                                                AS currency_code,
  cur.name                                                                AS currency_name,
  COALESCE(cur.symbol, cur.code)                                          AS currency_symbol,
  ba."createdAt"                                                          AS created_at,
  ba."updatedAt"                                                          AS updated_at
FROM "BankAccount" ba
JOIN  "Company"  co  ON co.id = ba."companyId"
JOIN  "Currency" cur ON cur.id = ba."currencyId";


CREATE OR REPLACE VIEW hv_bank_balance_by_company AS
SELECT
  co.id                                                                   AS company_id,
  co.name                                                                 AS company_name,
  co.code                                                                 AS company_code,
  cur.code                                                                AS currency_code,
  COALESCE(cur.symbol, cur.code)                                          AS currency_symbol,
  cur.name                                                                AS currency_name,
  COUNT(ba.id) FILTER (WHERE ba."isActive")                              AS active_account_count,
  COUNT(ba.id)                                                            AS total_account_count,
  COALESCE(SUM(ba.balance) FILTER (WHERE ba."isActive"), 0)::numeric     AS total_active_balance,
  COALESCE(SUM(ba.balance), 0)::numeric                                  AS total_balance
FROM "BankAccount" ba
JOIN  "Company"  co  ON co.id = ba."companyId"
JOIN  "Currency" cur ON cur.id = ba."currencyId"
GROUP BY co.id, co.name, co.code, cur.code, cur.symbol, cur.name;


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
  dbe."tarikCek"::numeric                                                 AS tarik_cek,
  COALESCE(dbe.note, '')                                                  AS note,
  COALESCE(dbe."createdBy", '')                                           AS created_by,
  dbe."createdAt"                                                         AS created_at
FROM "DailyBankEntry" dbe
JOIN  "BankAccount" ba  ON ba.id = dbe."bankAccountId"
JOIN  "Company"     co  ON co.id = ba."companyId"
JOIN  "Currency"    cur ON cur.id = ba."currencyId";


CREATE OR REPLACE VIEW hv_bank_mutations AS
SELECT
  bm.id,
  bm."bankAccountId"                                                      AS bank_account_id,
  ba."bankName"                                                           AS bank_name,
  ba."accountName"                                                        AS account_name,
  ba."companyId"                                                          AS company_id,
  COALESCE(co.name, '')                                                   AS company_name,
  COALESCE(co.code, '')                                                   AS company_code,
  cur.code                                                                AS currency_code,
  COALESCE(cur.symbol, cur.code)                                          AS currency_symbol,
  bm.type                                                                 AS mutation_type,
  CASE bm.type
    WHEN 'CREDIT' THEN 'Masuk'
    WHEN 'DEBIT'  THEN 'Keluar'
    ELSE bm.type::text
  END                                                                     AS mutation_type_label,
  bm.amount::numeric                                                      AS amount,
  bm."balanceAfter"::numeric                                              AS balance_after,
  COALESCE(bm.description, '')                                            AS description,
  COALESCE(bm."createdBy", '')                                            AS created_by,
  bm."createdAt"                                                          AS created_at,
  EXTRACT(YEAR  FROM bm."createdAt")::int                                 AS year,
  EXTRACT(MONTH FROM bm."createdAt")::int                                 AS month,
  TO_CHAR(bm."createdAt", 'YYYY-MM')                                      AS period_label
FROM "BankMutation" bm
JOIN  "BankAccount" ba  ON ba.id = bm."bankAccountId"
JOIN  "Company"     co  ON co.id = ba."companyId"
JOIN  "Currency"    cur ON cur.id = ba."currencyId";

GRANT SELECT ON hv_bank_accounts             TO oc_pvi_reader;
GRANT SELECT ON hv_bank_balance_by_company   TO oc_pvi_reader;
GRANT SELECT ON hv_bank_daily                TO oc_pvi_reader;
GRANT SELECT ON hv_bank_mutations            TO oc_pvi_reader;
