-- =============================================================================
-- OPENCLAW READ-ONLY ACCESS SETUP
-- Pusat Kirim Duit Management System
-- =============================================================================
-- PURPOSE:
--   Creates a restricted PostgreSQL user and a set of views exposing only
--   owner-relevant business data. Auth tables (passwords, tokens, sessions)
--   are never exposed. All views are prefixed with "oc_".
--
-- HOW TO RUN:
--   1. Connect as a superuser (e.g., postgres):
--        psql -U postgres -d your_database_name
--   2. Run this file:
--        \i sql/openclaw_setup.sql
--   3. Change the password on line ~30 before running in production.
-- =============================================================================


-- =============================================================================
-- STEP 1: CREATE READ-ONLY USER
-- =============================================================================

-- Change 'your_strong_password_here' before running in production
CREATE USER oc_pvi_reader WITH PASSWORD 'your_strong_password_here';

-- Allow connection to the database (replace 'your_database_name' with actual DB name)
-- GRANT CONNECT ON DATABASE your_database_name TO oc_pvi_reader;

GRANT USAGE ON SCHEMA public TO oc_pvi_reader;

-- Explicitly deny access to all base tables (belt-and-suspenders)
-- The user only gets SELECT on the oc_ views defined below.


-- =============================================================================
-- STEP 2: VIEWS
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 2.1 COMPANIES
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW oc_companies AS
SELECT
    c.id,
    c.name,
    c.code,
    c."isActive",
    COUNT(DISTINCT b.id)  AS branch_count,
    COUNT(DISTINCT u.id)  AS employee_count,
    c."createdAt"
FROM "Company" c
LEFT JOIN "Branch"  b ON b."companyId" = c.id AND b."isActive" = true
LEFT JOIN "user"    u ON u."companyId" = c.id AND u."isActive" = true
GROUP BY c.id, c.name, c.code, c."isActive", c."createdAt";


-- -----------------------------------------------------------------------------
-- 2.2 BRANCHES
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW oc_branches AS
SELECT
    b.id,
    b.name,
    b.address,
    b.phone,
    b."isActive",
    b."companyId",
    c.name  AS company_name,
    c.code  AS company_code,
    COUNT(DISTINCT u.id) AS employee_count,
    b."createdAt"
FROM "Branch"  b
LEFT JOIN "Company" c ON c.id = b."companyId"
LEFT JOIN "user"    u ON u."branchId" = b.id AND u."isActive" = true
GROUP BY b.id, b.name, b.address, b.phone, b."isActive", b."companyId",
         c.name, c.code, b."createdAt";


-- -----------------------------------------------------------------------------
-- 2.3 EMPLOYEES  (no password, no tokens, no auth metadata)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW oc_employees AS
SELECT
    u.id,
    u.name,
    u.email,
    u.phone,
    u."isActive",
    u."joinDate",
    -- Salary components
    u."baseSalary",
    u."mealAllowance",
    u."transportAllowance",
    (COALESCE(u."baseSalary", 0)
     + COALESCE(u."mealAllowance", 0)
     + COALESCE(u."transportAllowance", 0)) AS total_fixed_salary,
    -- Location
    u."branchId",
    b.name  AS branch_name,
    u."companyId",
    c.name  AS company_name,
    c.code  AS company_code,
    -- Role
    u."customRoleId",
    cr.name AS role_name,
    u."createdAt"
FROM "user"         u
LEFT JOIN "Branch"      b  ON b.id  = u."branchId"
LEFT JOIN "Company"     c  ON c.id  = u."companyId"
LEFT JOIN "custom_role" cr ON cr.id = u."customRoleId";


-- -----------------------------------------------------------------------------
-- 2.4 ATTENDANCE — DAILY DETAIL
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW oc_attendance AS
SELECT
    a.id,
    a."userId",
    u.name         AS employee_name,
    u."companyId",
    c.name         AS company_name,
    a."branchId",
    b.name         AS branch_name,
    a.date,
    a."checkIn",
    a."checkOut",
    CASE
        WHEN a."checkIn" IS NOT NULL AND a."checkOut" IS NOT NULL
        THEN ROUND(
            EXTRACT(EPOCH FROM (a."checkOut" - a."checkIn")) / 3600.0, 2
        )
        ELSE NULL
    END            AS work_hours,
    a.status,
    a."isLocationSuspect",
    a.notes
FROM "Attendance" a
JOIN "user"     u ON u.id = a."userId"
LEFT JOIN "Branch"   b ON b.id = a."branchId"
LEFT JOIN "Company"  c ON c.id = u."companyId";


-- -----------------------------------------------------------------------------
-- 2.5 ATTENDANCE — MONTHLY SUMMARY PER EMPLOYEE
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW oc_attendance_monthly AS
SELECT
    a."userId",
    u.name                          AS employee_name,
    u."companyId",
    c.name                          AS company_name,
    a."branchId",
    b.name                          AS branch_name,
    EXTRACT(YEAR  FROM a.date)::int AS year,
    EXTRACT(MONTH FROM a.date)::int AS month,
    COUNT(*) FILTER (WHERE a.status = 'PRESENT')    AS present_days,
    COUNT(*) FILTER (WHERE a.status = 'LATE')       AS late_days,
    COUNT(*) FILTER (WHERE a.status = 'ABSENT')     AS absent_days,
    COUNT(*) FILTER (WHERE a.status = 'PERMISSION') AS permission_days,
    COUNT(*) FILTER (WHERE a.status = 'SICK')       AS sick_days,
    COUNT(*) FILTER (WHERE a.status = 'HOLIDAY')    AS holiday_days,
    COUNT(*)                                        AS total_recorded_days,
    COUNT(*) FILTER (WHERE a."isLocationSuspect" = true) AS suspect_location_days
FROM "Attendance" a
JOIN "user"    u ON u.id = a."userId"
LEFT JOIN "Branch"  b ON b.id = a."branchId"
LEFT JOIN "Company" c ON c.id = u."companyId"
GROUP BY
    a."userId", u.name, u."companyId", c.name,
    a."branchId", b.name,
    EXTRACT(YEAR FROM a.date), EXTRACT(MONTH FROM a.date);


-- -----------------------------------------------------------------------------
-- 2.6 PAYROLL — MONTHLY ESTIMATE PER EMPLOYEE
--   Mirrors the logic in backend/services/payroll.service.ts:
--     late deduction  : lateMinutes × Rp 1.000
--     daily rate      : total_gross_fixed / 24
--     absence penalty : SICK=1×, PERMISSION=1× (or 2× if "tanpa surat"), ABSENT=2×
--     take-home       : total_gross_fixed − deductions + kpi_bonus
--   NOTE: requires KpiMonthlyResult to be populated for the period.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW oc_payroll_monthly AS
WITH attendance_deductions AS (
    SELECT
        a."userId",
        EXTRACT(YEAR  FROM a.date)::int AS year,
        EXTRACT(MONTH FROM a.date)::int AS month,
        -- Late: minutes past 17:40 × Rp 1.000
        SUM(
            CASE
                WHEN a.status = 'LATE' AND a."checkIn" IS NOT NULL THEN
                    GREATEST(0,
                        (EXTRACT(HOUR   FROM a."checkIn") * 60
                       + EXTRACT(MINUTE FROM a."checkIn"))
                        - (17 * 60 + 40)
                    ) * 1000
                ELSE 0
            END
        ) AS late_deduction,
        -- Absence: expressed as a multiplier of the daily rate
        SUM(
            CASE a.status
                WHEN 'SICK'    THEN 1
                WHEN 'ABSENT'  THEN 2
                WHEN 'PERMISSION' THEN
                    CASE WHEN LOWER(COALESCE(a.notes, '')) LIKE '%tanpa surat%'
                         THEN 2 ELSE 1 END
                ELSE 0
            END
        ) AS absence_multiplier,
        COUNT(*) FILTER (WHERE a.status = 'PRESENT')    AS present_days,
        COUNT(*) FILTER (WHERE a.status = 'LATE')       AS late_days,
        COUNT(*) FILTER (WHERE a.status = 'ABSENT')     AS absent_days,
        COUNT(*) FILTER (WHERE a.status = 'SICK')       AS sick_days,
        COUNT(*) FILTER (WHERE a.status = 'PERMISSION') AS permission_days
    FROM "Attendance" a
    GROUP BY a."userId",
             EXTRACT(YEAR FROM a.date),
             EXTRACT(MONTH FROM a.date)
)
SELECT
    u.id                      AS employee_id,
    u.name                    AS employee_name,
    u."companyId",
    c.name                    AS company_name,
    u."branchId",
    b.name                    AS branch_name,
    cr.name                   AS role_name,
    km.month,
    km.year,
    -- Fixed salary components
    COALESCE(u."baseSalary", 0)          AS base_salary,
    COALESCE(u."mealAllowance", 0)       AS meal_allowance,
    COALESCE(u."transportAllowance", 0)  AS transport_allowance,
    (COALESCE(u."baseSalary", 0)
     + COALESCE(u."mealAllowance", 0)
     + COALESCE(u."transportAllowance", 0))           AS total_gross_fixed,
    -- Attendance
    COALESCE(ad.present_days, 0)         AS present_days,
    COALESCE(ad.late_days, 0)            AS late_days,
    COALESCE(ad.absent_days, 0)          AS absent_days,
    COALESCE(ad.sick_days, 0)            AS sick_days,
    COALESCE(ad.permission_days, 0)      AS permission_days,
    -- Deductions
    COALESCE(ad.late_deduction, 0)       AS late_deduction,
    ROUND(
        COALESCE(ad.absence_multiplier, 0)
        * (COALESCE(u."baseSalary", 0)
           + COALESCE(u."mealAllowance", 0)
           + COALESCE(u."transportAllowance", 0)) / 24.0
    , 0)                                 AS absence_deduction,
    ROUND(
        COALESCE(ad.late_deduction, 0)
        + COALESCE(ad.absence_multiplier, 0)
          * (COALESCE(u."baseSalary", 0)
             + COALESCE(u."mealAllowance", 0)
             + COALESCE(u."transportAllowance", 0)) / 24.0
    , 0)                                 AS total_deductions,
    -- KPI
    COALESCE(km."totalScore", 0)         AS kpi_score,
    COALESCE(km."bonusAmount", 0)        AS kpi_bonus,
    km."bonusResult"                     AS kpi_bonus_type,
    -- Estimated take-home pay
    ROUND(
        (COALESCE(u."baseSalary", 0)
         + COALESCE(u."mealAllowance", 0)
         + COALESCE(u."transportAllowance", 0))
        - COALESCE(ad.late_deduction, 0)
        - COALESCE(ad.absence_multiplier, 0)
          * (COALESCE(u."baseSalary", 0)
             + COALESCE(u."mealAllowance", 0)
             + COALESCE(u."transportAllowance", 0)) / 24.0
        + COALESCE(km."bonusAmount", 0)
    , 0)                                 AS estimated_take_home_pay
FROM "KpiMonthlyResult" km
JOIN "user"         u  ON u.id  = km."employeeId"
LEFT JOIN "Branch"      b  ON b.id  = u."branchId"
LEFT JOIN "Company"     c  ON c.id  = u."companyId"
LEFT JOIN "custom_role" cr ON cr.id = u."customRoleId"
LEFT JOIN attendance_deductions ad
    ON ad."userId" = km."employeeId"
   AND ad.year     = km.year
   AND ad.month    = km.month;


-- -----------------------------------------------------------------------------
-- 2.7 KPI — MONTHLY RESULTS
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW oc_kpi_monthly AS
SELECT
    km.id,
    km."employeeId",
    u.name          AS employee_name,
    u."companyId",
    c.name          AS company_name,
    u."branchId",
    b.name          AS branch_name,
    cr.name         AS role_name,
    km.month,
    km.year,
    km."totalScore",
    km."bonusAmount",
    km."bonusResult",
    km."breakdownJson",
    km."calculatedAt"
FROM "KpiMonthlyResult" km
JOIN "user"         u  ON u.id  = km."employeeId"
LEFT JOIN "Branch"      b  ON b.id  = u."branchId"
LEFT JOIN "Company"     c  ON c.id  = u."companyId"
LEFT JOIN "custom_role" cr ON cr.id = u."customRoleId";


-- -----------------------------------------------------------------------------
-- 2.8 KPI — INDIVIDUAL LOG ENTRIES
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW oc_kpi_logs AS
SELECT
    kl.id,
    kl."employeeId",
    u.name      AS employee_name,
    u."companyId",
    c.name      AS company_name,
    kd.name     AS kpi_name,
    kd.type     AS kpi_type,
    kl.value,
    kl.note,
    kl."createdAt"
FROM "KpiLog"        kl
JOIN "user"          u  ON u.id  = kl."employeeId"
JOIN "KpiDefinition" kd ON kd.id = kl."kpiId"
LEFT JOIN "Company"  c  ON c.id  = u."companyId";


-- -----------------------------------------------------------------------------
-- 2.9 KPI — DEFINITIONS & ROLE WEIGHTS
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW oc_kpi_definitions AS
SELECT
    kd.id,
    kd.name         AS kpi_name,
    kd.type         AS kpi_type,
    rk."companyId",
    c.name          AS company_name,
    cr.name         AS role_name,
    rk."maxScore",
    rk."targetValue",
    rk."threshold",
    rk.weight
FROM "KpiDefinition" kd
LEFT JOIN "RoleKpi"     rk ON rk."kpiId"        = kd.id
LEFT JOIN "Company"     c  ON c.id              = rk."companyId"
LEFT JOIN "custom_role" cr ON cr.id             = rk."customRoleId";


-- -----------------------------------------------------------------------------
-- 2.10 REVENUE — DETAIL PER EMPLOYEE
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW oc_revenue AS
SELECT
    r.id,
    r."employeeId",
    u.name          AS employee_name,
    u."companyId",
    c.name          AS company_name,
    u."branchId",
    b.name          AS branch_name,
    r.amount,
    r.date,
    r.note,
    r."createdAt"
FROM "Revenue"   r
JOIN "user"      u ON u.id = r."employeeId"
LEFT JOIN "Branch"   b ON b.id = u."branchId"
LEFT JOIN "Company"  c ON c.id = u."companyId";


-- -----------------------------------------------------------------------------
-- 2.11 REVENUE — MONTHLY SUMMARY PER EMPLOYEE
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW oc_revenue_monthly AS
SELECT
    r."employeeId",
    u.name                          AS employee_name,
    u."companyId",
    c.name                          AS company_name,
    u."branchId",
    b.name                          AS branch_name,
    EXTRACT(YEAR  FROM r.date)::int AS year,
    EXTRACT(MONTH FROM r.date)::int AS month,
    COUNT(*)                        AS transaction_count,
    SUM(r.amount)                   AS total_revenue,
    ROUND(AVG(r.amount), 0)         AS avg_revenue
FROM "Revenue"   r
JOIN "user"      u ON u.id = r."employeeId"
LEFT JOIN "Branch"   b ON b.id = u."branchId"
LEFT JOIN "Company"  c ON c.id = u."companyId"
GROUP BY
    r."employeeId", u.name, u."companyId", c.name,
    u."branchId", b.name,
    EXTRACT(YEAR FROM r.date), EXTRACT(MONTH FROM r.date);


-- -----------------------------------------------------------------------------
-- 2.12 BANK ACCOUNTS — CURRENT STATE
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW oc_bank_accounts AS
SELECT
    ba.id,
    ba."bankName",
    ba."accountNumber",
    ba."accountName",
    ba.balance      AS current_balance,
    ba."isActive",
    ba.note,
    ba."sortOrder",
    ba."branchId",
    b.name          AS branch_name,
    b."companyId",
    c.name          AS company_name,
    c.code          AS company_code,
    cur.code        AS currency_code,
    cur.name        AS currency_name,
    cur.symbol      AS currency_symbol,
    ba."createdAt",
    ba."updatedAt"
FROM "BankAccount" ba
JOIN "Branch"   b   ON b.id   = ba."branchId"
LEFT JOIN "Company"  c   ON c.id   = b."companyId"
JOIN "Currency"  cur ON cur.id = ba."currencyId";


-- -----------------------------------------------------------------------------
-- 2.13 BANK ACCOUNTS — TOTAL BALANCE GROUPED BY COMPANY & CURRENCY
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW oc_bank_balance_by_company AS
SELECT
    c.id            AS company_id,
    c.name          AS company_name,
    c.code          AS company_code,
    cur.code        AS currency_code,
    cur.symbol      AS currency_symbol,
    COUNT(ba.id)    AS account_count,
    SUM(ba.balance) AS total_balance
FROM "BankAccount" ba
JOIN "Branch"   b   ON b.id   = ba."branchId"
JOIN "Company"  c   ON c.id   = b."companyId"
JOIN "Currency" cur ON cur.id = ba."currencyId"
WHERE ba."isActive" = true
GROUP BY c.id, c.name, c.code, cur.code, cur.symbol;


-- -----------------------------------------------------------------------------
-- 2.14 BANK — DAILY ENTRIES
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW oc_bank_daily AS
SELECT
    dbe.id,
    dbe."bankAccountId",
    ba."bankName",
    ba."accountName",
    ba."branchId",
    b.name          AS branch_name,
    b."companyId",
    c.name          AS company_name,
    cur.code        AS currency_code,
    dbe.date,
    dbe.balance,
    dbe."tarikCek",
    dbe.note,
    dbe."createdBy",
    dbe."createdAt"
FROM "DailyBankEntry" dbe
JOIN "BankAccount"  ba  ON ba.id  = dbe."bankAccountId"
JOIN "Branch"       b   ON b.id   = ba."branchId"
LEFT JOIN "Company" c   ON c.id   = b."companyId"
JOIN "Currency"     cur ON cur.id = ba."currencyId";


-- -----------------------------------------------------------------------------
-- 2.15 BANK — MUTATIONS (CREDIT / DEBIT TRANSACTIONS)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW oc_bank_mutations AS
SELECT
    bm.id,
    bm."bankAccountId",
    ba."bankName",
    ba."accountName",
    ba."branchId",
    b.name          AS branch_name,
    b."companyId",
    c.name          AS company_name,
    cur.code        AS currency_code,
    bm.type,
    bm.amount,
    bm."balanceAfter",
    bm.description,
    bm."createdBy",
    bm."createdAt"
FROM "BankMutation"  bm
JOIN "BankAccount"   ba  ON ba.id  = bm."bankAccountId"
JOIN "Branch"        b   ON b.id   = ba."branchId"
LEFT JOIN "Company"  c   ON c.id   = b."companyId"
JOIN "Currency"      cur ON cur.id = ba."currencyId";


-- -----------------------------------------------------------------------------
-- 2.16 CURRENCY STOCK — CURRENT POSITION PER BRANCH
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW oc_currency_stock AS
SELECT
    cs.id,
    cs."branchId",
    b.name          AS branch_name,
    b."companyId",
    c.name          AS company_name,
    c.code          AS company_code,
    cur.code        AS currency_code,
    cur.name        AS currency_name,
    cur.symbol      AS currency_symbol,
    cs.quantity,
    cs."buyRate",
    cs."sellRate",
    CASE WHEN cs."buyRate"  IS NOT NULL THEN cs.quantity * cs."buyRate"  END AS idr_value_at_buy_rate,
    CASE WHEN cs."sellRate" IS NOT NULL THEN cs.quantity * cs."sellRate" END AS idr_value_at_sell_rate,
    cs."updatedAt"
FROM "CurrencyStock" cs
JOIN "Branch"   b   ON b.id   = cs."branchId"
LEFT JOIN "Company"  c   ON c.id   = b."companyId"
JOIN "Currency"  cur ON cur.id = cs."currencyId";


-- -----------------------------------------------------------------------------
-- 2.17 CURRENCY STOCK — TOTAL BY COMPANY & CURRENCY
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW oc_currency_stock_by_company AS
SELECT
    c.id            AS company_id,
    c.name          AS company_name,
    c.code          AS company_code,
    cur.code        AS currency_code,
    cur.name        AS currency_name,
    cur.symbol      AS currency_symbol,
    SUM(cs.quantity)                AS total_quantity,
    ROUND(AVG(cs."buyRate"),  4)    AS avg_buy_rate,
    ROUND(AVG(cs."sellRate"), 4)    AS avg_sell_rate,
    SUM(
        CASE WHEN cs."buyRate" IS NOT NULL
             THEN cs.quantity * cs."buyRate" ELSE 0 END
    )                               AS total_idr_at_buy_rate
FROM "CurrencyStock" cs
JOIN "Branch"   b   ON b.id   = cs."branchId"
JOIN "Company"  c   ON c.id   = b."companyId"
JOIN "Currency" cur ON cur.id = cs."currencyId"
GROUP BY c.id, c.name, c.code, cur.code, cur.name, cur.symbol;


-- -----------------------------------------------------------------------------
-- 2.18 STOCK — DAILY ENTRIES (custom stock items incl. gold, cash)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW oc_stock_daily AS
SELECT
    dse.id,
    dse."stockItemId",
    si.name         AS stock_item_name,
    si.code         AS stock_item_code,
    si.type         AS stock_item_type,
    si."branchId",
    b.name          AS branch_name,
    b."companyId",
    c.name          AS company_name,
    dse.date,
    dse."closingQty",
    dse."rateIdr",
    dse."totalIdr",
    dse.qty1,
    dse.qty2,
    dse.note,
    dse."createdBy",
    dse."createdAt"
FROM "DailyStockEntry" dse
JOIN "StockItem"  si ON si.id = dse."stockItemId"
JOIN "Branch"     b  ON b.id  = si."branchId"
LEFT JOIN "Company"  c  ON c.id  = b."companyId";


-- -----------------------------------------------------------------------------
-- 2.19 BONUS MATRIX — TIERS PER COMPANY & ROLE
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW oc_bonus_tiers AS
SELECT
    bm.id           AS matrix_id,
    bm."companyId",
    c.name          AS company_name,
    cr.name         AS role_name,
    bt.id           AS tier_id,
    bt."minScore",
    bt."maxScore",
    bt."resultType",
    bt.amount,
    bt."isTopPerformer"
FROM "BonusMatrix"   bm
JOIN "Company"       c   ON c.id   = bm."companyId"
LEFT JOIN "custom_role" cr ON cr.id = bm."customRoleId"
JOIN "BonusTier"     bt  ON bt."matrixId" = bm.id;


-- =============================================================================
-- STEP 3: GRANT SELECT ON ALL VIEWS TO oc_pvi_reader
-- =============================================================================

GRANT SELECT ON oc_companies                TO oc_pvi_reader;
GRANT SELECT ON oc_branches                 TO oc_pvi_reader;
GRANT SELECT ON oc_employees                TO oc_pvi_reader;
GRANT SELECT ON oc_attendance               TO oc_pvi_reader;
GRANT SELECT ON oc_attendance_monthly       TO oc_pvi_reader;
GRANT SELECT ON oc_payroll_monthly          TO oc_pvi_reader;
GRANT SELECT ON oc_kpi_monthly              TO oc_pvi_reader;
GRANT SELECT ON oc_kpi_logs                 TO oc_pvi_reader;
GRANT SELECT ON oc_kpi_definitions          TO oc_pvi_reader;
GRANT SELECT ON oc_revenue                  TO oc_pvi_reader;
GRANT SELECT ON oc_revenue_monthly          TO oc_pvi_reader;
GRANT SELECT ON oc_bank_accounts            TO oc_pvi_reader;
GRANT SELECT ON oc_bank_balance_by_company  TO oc_pvi_reader;
GRANT SELECT ON oc_bank_daily               TO oc_pvi_reader;
GRANT SELECT ON oc_bank_mutations           TO oc_pvi_reader;
GRANT SELECT ON oc_currency_stock           TO oc_pvi_reader;
GRANT SELECT ON oc_currency_stock_by_company TO oc_pvi_reader;
GRANT SELECT ON oc_stock_daily              TO oc_pvi_reader;
GRANT SELECT ON oc_bonus_tiers              TO oc_pvi_reader;

-- Revoke all access on base tables and auth tables (explicit safety)
REVOKE ALL ON "user"         FROM oc_pvi_reader;
REVOKE ALL ON "account"      FROM oc_pvi_reader;
REVOKE ALL ON "session"      FROM oc_pvi_reader;
REVOKE ALL ON "verification" FROM oc_pvi_reader;

-- Done.
-- Connection string for Openclaw:
--   postgresql://oc_pvi_reader:your_strong_password_here@host:5432/your_database_name
