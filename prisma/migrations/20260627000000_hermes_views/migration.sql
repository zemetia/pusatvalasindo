-- ================================================================
-- HERMES VIEWS — AI-Ready Read Layer
-- Pusat Kirim Duit Management System
-- ================================================================
-- Prefix      : hv_   (hermes_views)
-- Reader user : oc_pvi_reader  (SELECT-only, no auth data)
-- Views       : 19 views covering all business domains
--
-- AI-ready design principles applied:
--   • All enum columns have a companion _label column (Bahasa Indonesia)
--   • period_label column (YYYY-MM) on every time-series view
--   • Monetary values in IDR unless currency_code column is present
--   • COALESCE on all nullable text/numeric to avoid NULL surprises
--   • Derived/computed columns pre-calculated (work_hours, deductions, etc.)
--   • context_summary text field on key entity views for RAG/embeddings
--   • Consistent snake_case output column names
--   • No auth-sensitive data (passwords, tokens, sessions never exposed)
-- ================================================================

-- ============================================================
-- 1. hv_companies
--    One row per PT company with live branch & headcount stats
-- ============================================================
CREATE OR REPLACE VIEW hv_companies AS
SELECT
  c.id,
  c.name                                                                  AS company_name,
  c.code                                                                  AS company_code,
  c."isActive"                                                            AS is_active,
  CASE WHEN c."isActive" THEN 'Aktif' ELSE 'Tidak Aktif' END             AS status_label,
  COUNT(DISTINCT b.id) FILTER (WHERE b."isActive")                       AS active_branch_count,
  COUNT(DISTINCT b.id)                                                    AS total_branch_count,
  COUNT(DISTINCT u.id) FILTER (WHERE u."isActive")                       AS active_employee_count,
  COUNT(DISTINCT u.id)                                                    AS total_employee_count,
  c."createdAt"                                                           AS created_at
FROM "Company" c
LEFT JOIN "Branch" b ON b."companyId" = c.id
LEFT JOIN "user"   u ON u."companyId" = c.id
GROUP BY c.id, c.name, c.code, c."isActive", c."createdAt";


-- ============================================================
-- 2. hv_branches
--    One row per branch with company context and headcount
-- ============================================================
CREATE OR REPLACE VIEW hv_branches AS
SELECT
  b.id,
  b.name                                                                  AS branch_name,
  COALESCE(b.address, '')                                                 AS address,
  COALESCE(b.phone, '')                                                   AS phone,
  b."isActive"                                                            AS is_active,
  CASE WHEN b."isActive" THEN 'Aktif' ELSE 'Tidak Aktif' END             AS status_label,
  b."companyId"                                                           AS company_id,
  COALESCE(co.name, '')                                                   AS company_name,
  COALESCE(co.code, '')                                                   AS company_code,
  COUNT(DISTINCT u.id) FILTER (WHERE u."isActive")                       AS active_employee_count,
  COUNT(DISTINCT u.id)                                                    AS total_employee_count,
  b."createdAt"                                                           AS created_at
FROM "Branch" b
LEFT JOIN "Company" co ON co.id = b."companyId"
LEFT JOIN "user"     u ON u."branchId" = b.id
GROUP BY b.id, b.name, b.address, b.phone, b."isActive",
         b."companyId", b."createdAt", co.name, co.code;


-- ============================================================
-- 3. hv_employees
--    All employees with salary breakdown and org context.
--    Auth-sensitive fields excluded (password, token, image).
-- ============================================================
CREATE OR REPLACE VIEW hv_employees AS
SELECT
  u.id,
  u.name,
  u.email,
  COALESCE(u.phone, '')                                                   AS phone,
  u."isActive"                                                            AS is_active,
  CASE WHEN u."isActive" THEN 'Aktif' ELSE 'Tidak Aktif' END             AS status_label,
  u."joinDate"::date                                                      AS join_date,
  -- Salary components (IDR)
  COALESCE(u."baseSalary", 0)::numeric                                   AS base_salary,
  COALESCE(u."mealAllowance", 0)::numeric                                AS meal_allowance,
  COALESCE(u."transportAllowance", 0)::numeric                           AS transport_allowance,
  (COALESCE(u."baseSalary", 0)
    + COALESCE(u."mealAllowance", 0)
    + COALESCE(u."transportAllowance", 0))::numeric                      AS total_fixed_salary,
  ROUND(
    (COALESCE(u."baseSalary", 0)
      + COALESCE(u."mealAllowance", 0)
      + COALESCE(u."transportAllowance", 0))::numeric / 24, 0
  )                                                                       AS daily_rate,
  -- Organization
  u."branchId"                                                            AS branch_id,
  COALESCE(b.name, '')                                                    AS branch_name,
  COALESCE(u."companyId", b."companyId")                                  AS company_id,
  COALESCE(co.name, '')                                                   AS company_name,
  COALESCE(co.code, '')                                                   AS company_code,
  u."customRoleId"                                                        AS role_id,
  COALESCE(cr.name, 'Tanpa Role')                                        AS role_name,
  -- Pre-formatted summary for RAG / embedding context
  CONCAT(
    u.name,
    ' — ', COALESCE(cr.name, 'Tanpa Role'),
    ' di ', COALESCE(co.name, 'PT tidak diketahui'),
    ' cabang ', COALESCE(b.name, 'tidak diketahui'),
    ' | Gaji pokok Rp ', TO_CHAR(COALESCE(u."baseSalary", 0)::numeric, 'FM999,999,999'),
    ' | Total tetap Rp ', TO_CHAR(
      (COALESCE(u."baseSalary", 0)
        + COALESCE(u."mealAllowance", 0)
        + COALESCE(u."transportAllowance", 0))::numeric,
      'FM999,999,999'
    ),
    CASE WHEN u."isActive" THEN ' | Aktif' ELSE ' | Tidak Aktif' END
  )                                                                       AS context_summary,
  u."createdAt"                                                           AS created_at
FROM "user" u
LEFT JOIN "Branch"      b  ON b.id = u."branchId"
LEFT JOIN "Company"     co ON co.id = COALESCE(u."companyId", b."companyId")
LEFT JOIN "custom_role" cr ON cr.id = u."customRoleId";


-- ============================================================
-- 4. hv_attendance
--    Daily attendance records.
--    work_hours computed from checkIn/checkOut.
--    GPS coordinates omitted (privacy); suspect flag retained.
-- ============================================================
CREATE OR REPLACE VIEW hv_attendance AS
SELECT
  a.id,
  a."userId"                                                              AS user_id,
  u.name                                                                  AS employee_name,
  COALESCE(co.name, '')                                                   AS company_name,
  COALESCE(co.code, '')                                                   AS company_code,
  COALESCE(b.name, '')                                                    AS branch_name,
  COALESCE(cr.name, '')                                                   AS role_name,
  a.date,
  EXTRACT(YEAR  FROM a.date)::int                                         AS year,
  EXTRACT(MONTH FROM a.date)::int                                         AS month,
  TO_CHAR(a.date, 'YYYY-MM')                                              AS period_label,
  a."checkIn",
  a."checkOut",
  CASE
    WHEN a."checkIn" IS NOT NULL AND a."checkOut" IS NOT NULL
    THEN ROUND(
      EXTRACT(EPOCH FROM (a."checkOut" - a."checkIn"))::numeric / 3600, 2
    )
    ELSE NULL
  END                                                                     AS work_hours,
  a.status,
  CASE a.status
    WHEN 'PRESENT'    THEN 'Hadir'
    WHEN 'LATE'       THEN 'Terlambat'
    WHEN 'ABSENT'     THEN 'Tidak Hadir'
    WHEN 'PERMISSION' THEN 'Izin'
    WHEN 'SICK'       THEN 'Sakit'
    WHEN 'HOLIDAY'    THEN 'Libur'
    ELSE a.status::text
  END                                                                     AS status_label,
  a."isLocationSuspect"                                                   AS is_location_suspect,
  a."isWithDoctorNote"                                                    AS is_with_doctor_note,
  COALESCE(a.notes, '')                                                   AS notes,
  a."createdAt"                                                           AS created_at
FROM "Attendance" a
JOIN  "user"        u  ON u.id = a."userId"
LEFT JOIN "Branch"  b  ON b.id = a."branchId"
LEFT JOIN "Company" co ON co.id = u."companyId"
LEFT JOIN "custom_role" cr ON cr.id = u."customRoleId";


-- ============================================================
-- 5. hv_attendance_monthly
--    Monthly attendance summary per employee.
--    Aggregates work hours, day-type counts, and suspect flags.
-- ============================================================
CREATE OR REPLACE VIEW hv_attendance_monthly AS
SELECT
  a."userId"                                                              AS user_id,
  u.name                                                                  AS employee_name,
  u."companyId"                                                           AS company_id,
  COALESCE(co.name, '')                                                   AS company_name,
  COALESCE(co.code, '')                                                   AS company_code,
  u."branchId"                                                            AS branch_id,
  COALESCE(b.name, '')                                                    AS branch_name,
  COALESCE(cr.name, '')                                                   AS role_name,
  EXTRACT(YEAR  FROM a.date)::int                                         AS year,
  EXTRACT(MONTH FROM a.date)::int                                         AS month,
  TO_CHAR(DATE_TRUNC('month', a.date), 'YYYY-MM')                        AS period_label,
  -- Day-type counts
  COUNT(*) FILTER (WHERE a.status = 'PRESENT')                           AS present_days,
  COUNT(*) FILTER (WHERE a.status = 'LATE')                              AS late_days,
  COUNT(*) FILTER (WHERE a.status = 'ABSENT')                            AS absent_days,
  COUNT(*) FILTER (WHERE a.status = 'SICK' AND a."isWithDoctorNote")     AS sick_days_with_note,
  COUNT(*) FILTER (WHERE a.status = 'SICK' AND NOT a."isWithDoctorNote") AS sick_days_no_note,
  COUNT(*) FILTER (WHERE a.status = 'SICK')                              AS sick_days_total,
  COUNT(*) FILTER (WHERE a.status = 'PERMISSION')                        AS permission_days,
  COUNT(*) FILTER (WHERE a.status = 'HOLIDAY')                           AS holiday_days,
  COUNT(*)                                                                 AS total_recorded_days,
  COUNT(*) FILTER (WHERE a."isLocationSuspect")                          AS suspect_location_days,
  -- Work hour aggregates (from actual clock-in/out data)
  ROUND(SUM(
    CASE
      WHEN a."checkIn" IS NOT NULL AND a."checkOut" IS NOT NULL
      THEN EXTRACT(EPOCH FROM (a."checkOut" - a."checkIn"))::numeric / 3600
      ELSE 0
    END
  )::numeric, 2)                                                          AS total_work_hours,
  ROUND(AVG(
    CASE
      WHEN a."checkIn" IS NOT NULL AND a."checkOut" IS NOT NULL
      THEN EXTRACT(EPOCH FROM (a."checkOut" - a."checkIn"))::numeric / 3600
      ELSE NULL
    END
  )::numeric, 2)                                                          AS avg_work_hours_per_day
FROM "Attendance" a
JOIN  "user"           u  ON u.id = a."userId"
LEFT JOIN "Branch"     b  ON b.id = u."branchId"
LEFT JOIN "Company"    co ON co.id = u."companyId"
LEFT JOIN "custom_role" cr ON cr.id = u."customRoleId"
GROUP BY
  a."userId", u.name, u."companyId", u."branchId",
  co.name, co.code, b.name, cr.name,
  EXTRACT(YEAR FROM a.date), EXTRACT(MONTH FROM a.date),
  DATE_TRUNC('month', a.date);


-- ============================================================
-- 6. hv_kpi_definitions
--    KPI definitions per role per company with weight context.
--    weight_pct shows relative importance within the same role.
-- ============================================================
CREATE OR REPLACE VIEW hv_kpi_definitions AS
SELECT
  rk.id,
  kd.id                                                                   AS kpi_id,
  kd.name                                                                 AS kpi_name,
  kd.type                                                                 AS kpi_type,
  CASE kd.type
    WHEN 'EVENT'  THEN 'Event / Kejadian'
    WHEN 'TARGET' THEN 'Target Nilai'
    ELSE kd.type::text
  END                                                                     AS kpi_type_label,
  rk."companyId"                                                          AS company_id,
  COALESCE(co.name, '')                                                   AS company_name,
  COALESCE(co.code, '')                                                   AS company_code,
  rk."customRoleId"                                                       AS role_id,
  COALESCE(cr.name, '')                                                   AS role_name,
  rk."maxScore"::numeric                                                  AS max_score,
  rk."targetValue"::numeric                                               AS target_value,
  rk."threshold"::numeric                                                 AS threshold,
  rk.weight::numeric                                                      AS weight,
  ROUND(
    rk.weight::numeric
    / NULLIF(SUM(rk.weight::numeric) OVER (PARTITION BY rk."companyId", rk."customRoleId"), 0)
    * 100, 2
  )                                                                       AS weight_pct,
  kd."createdAt"                                                          AS created_at
FROM "RoleKpi" rk
JOIN  "KpiDefinition"  kd ON kd.id = rk."kpiId"
JOIN  "Company"        co ON co.id = rk."companyId"
LEFT JOIN "custom_role" cr ON cr.id = rk."customRoleId";


-- ============================================================
-- 7. hv_kpi_logs
--    Individual KPI log entries with full org context.
-- ============================================================
CREATE OR REPLACE VIEW hv_kpi_logs AS
SELECT
  kl.id,
  kl."employeeId"                                                         AS employee_id,
  u.name                                                                  AS employee_name,
  u."companyId"                                                           AS company_id,
  COALESCE(co.name, '')                                                   AS company_name,
  COALESCE(co.code, '')                                                   AS company_code,
  COALESCE(b.name, '')                                                    AS branch_name,
  COALESCE(cr.name, '')                                                   AS role_name,
  kl."kpiId"                                                              AS kpi_id,
  kd.name                                                                 AS kpi_name,
  kd.type                                                                 AS kpi_type,
  CASE kd.type
    WHEN 'EVENT'  THEN 'Event / Kejadian'
    WHEN 'TARGET' THEN 'Target Nilai'
    ELSE kd.type::text
  END                                                                     AS kpi_type_label,
  kl.value::numeric                                                       AS value,
  COALESCE(kl.note, '')                                                   AS note,
  kl."createdAt"                                                          AS created_at,
  EXTRACT(YEAR  FROM kl."createdAt")::int                                 AS year,
  EXTRACT(MONTH FROM kl."createdAt")::int                                 AS month,
  TO_CHAR(kl."createdAt", 'YYYY-MM')                                      AS period_label
FROM "KpiLog" kl
JOIN  "user"           u  ON u.id = kl."employeeId"
JOIN  "KpiDefinition"  kd ON kd.id = kl."kpiId"
LEFT JOIN "Branch"     b  ON b.id = u."branchId"
LEFT JOIN "Company"    co ON co.id = u."companyId"
LEFT JOIN "custom_role" cr ON cr.id = u."customRoleId";


-- ============================================================
-- 8. hv_kpi_monthly
--    Monthly KPI results per employee.
--    Includes pre-computed grade (A/B/C/D) and bonus labels.
-- ============================================================
CREATE OR REPLACE VIEW hv_kpi_monthly AS
SELECT
  km.id,
  km."employeeId"                                                         AS employee_id,
  u.name                                                                  AS employee_name,
  u."companyId"                                                           AS company_id,
  COALESCE(co.name, '')                                                   AS company_name,
  COALESCE(co.code, '')                                                   AS company_code,
  u."branchId"                                                            AS branch_id,
  COALESCE(b.name, '')                                                    AS branch_name,
  COALESCE(cr.name, '')                                                   AS role_name,
  km.month,
  km.year,
  TO_CHAR(
    TO_DATE(km.year::text || '-' || LPAD(km.month::text, 2, '0') || '-01', 'YYYY-MM-DD'),
    'YYYY-MM'
  )                                                                       AS period_label,
  km."totalScore"::numeric                                                AS total_score,
  CASE
    WHEN km."totalScore" >= 90 THEN 'A'
    WHEN km."totalScore" >= 75 THEN 'B'
    WHEN km."totalScore" >= 60 THEN 'C'
    ELSE 'D'
  END                                                                     AS grade,
  CASE
    WHEN km."totalScore" >= 90 THEN 'Sangat Baik'
    WHEN km."totalScore" >= 75 THEN 'Baik'
    WHEN km."totalScore" >= 60 THEN 'Cukup'
    ELSE 'Perlu Peningkatan'
  END                                                                     AS grade_label,
  COALESCE(km."bonusAmount", 0)::numeric                                 AS bonus_amount,
  km."bonusResult"                                                        AS bonus_result,
  CASE km."bonusResult"
    WHEN 'BONUS_CASH'        THEN 'Bonus Cash'
    WHEN 'SAFE_ZONE'         THEN 'Aman (Tidak Bonus/Denda)'
    WHEN 'PENALTY_SATURDAY'  THEN 'Denda Masuk Sabtu'
    WHEN 'PENALTY_DEDUCTION' THEN 'Potongan Gaji'
    WHEN 'TOP_PERFORMER'     THEN 'Top Performer'
    ELSE 'Belum Dihitung'
  END                                                                     AS bonus_result_label,
  km."breakdownJson"                                                      AS breakdown_json,
  km."calculatedAt"                                                       AS calculated_at,
  -- RAG-friendly summary
  CONCAT(
    u.name, ' (', COALESCE(cr.name, '-'), ')',
    ' | KPI ', TO_CHAR(
      TO_DATE(km.year::text || '-' || LPAD(km.month::text, 2, '0') || '-01', 'YYYY-MM-DD'),
      'Mon YYYY'
    ),
    ' | Skor: ', km."totalScore"::numeric,
    ' | Grade: ',
    CASE WHEN km."totalScore" >= 90 THEN 'A'
         WHEN km."totalScore" >= 75 THEN 'B'
         WHEN km."totalScore" >= 60 THEN 'C'
         ELSE 'D' END,
    ' | ',
    CASE km."bonusResult"
      WHEN 'BONUS_CASH'        THEN 'Bonus Cash Rp ' || TO_CHAR(COALESCE(km."bonusAmount", 0)::numeric, 'FM999,999,999')
      WHEN 'SAFE_ZONE'         THEN 'Aman'
      WHEN 'PENALTY_SATURDAY'  THEN 'Denda Sabtu'
      WHEN 'PENALTY_DEDUCTION' THEN 'Potongan Rp ' || TO_CHAR(COALESCE(km."bonusAmount", 0)::numeric, 'FM999,999,999')
      WHEN 'TOP_PERFORMER'     THEN 'Top Performer!'
      ELSE 'Belum Ada Hasil'
    END
  )                                                                       AS context_summary
FROM "KpiMonthlyResult" km
JOIN  "user"           u  ON u.id = km."employeeId"
LEFT JOIN "Branch"     b  ON b.id = u."branchId"
LEFT JOIN "Company"    co ON co.id = u."companyId"
LEFT JOIN "custom_role" cr ON cr.id = u."customRoleId";


-- ============================================================
-- 9. hv_revenue
--    Daily revenue entries per employee.
-- ============================================================
CREATE OR REPLACE VIEW hv_revenue AS
SELECT
  r.id,
  r."employeeId"                                                          AS employee_id,
  u.name                                                                  AS employee_name,
  u."companyId"                                                           AS company_id,
  COALESCE(co.name, '')                                                   AS company_name,
  COALESCE(co.code, '')                                                   AS company_code,
  u."branchId"                                                            AS branch_id,
  COALESCE(b.name, '')                                                    AS branch_name,
  COALESCE(cr.name, '')                                                   AS role_name,
  r.amount::numeric                                                       AS amount,
  r.date,
  EXTRACT(YEAR  FROM r.date)::int                                         AS year,
  EXTRACT(MONTH FROM r.date)::int                                         AS month,
  TO_CHAR(r.date, 'YYYY-MM')                                              AS period_label,
  COALESCE(r.note, '')                                                    AS note,
  r."createdAt"                                                           AS created_at
FROM "Revenue" r
JOIN  "user"           u  ON u.id = r."employeeId"
LEFT JOIN "Branch"     b  ON b.id = u."branchId"
LEFT JOIN "Company"    co ON co.id = u."companyId"
LEFT JOIN "custom_role" cr ON cr.id = u."customRoleId";


-- ============================================================
-- 10. hv_revenue_monthly
--     Monthly revenue aggregation per employee.
--     Includes max/min for outlier detection.
-- ============================================================
CREATE OR REPLACE VIEW hv_revenue_monthly AS
SELECT
  r."employeeId"                                                          AS employee_id,
  u.name                                                                  AS employee_name,
  u."companyId"                                                           AS company_id,
  COALESCE(co.name, '')                                                   AS company_name,
  COALESCE(co.code, '')                                                   AS company_code,
  u."branchId"                                                            AS branch_id,
  COALESCE(b.name, '')                                                    AS branch_name,
  COALESCE(cr.name, '')                                                   AS role_name,
  EXTRACT(YEAR  FROM r.date)::int                                         AS year,
  EXTRACT(MONTH FROM r.date)::int                                         AS month,
  TO_CHAR(DATE_TRUNC('month', r.date), 'YYYY-MM')                        AS period_label,
  COUNT(*)                                                                 AS transaction_count,
  SUM(r.amount)::numeric                                                  AS total_revenue,
  ROUND(AVG(r.amount)::numeric, 0)                                        AS avg_revenue_per_entry,
  MAX(r.amount)::numeric                                                  AS max_single_entry,
  MIN(r.amount)::numeric                                                  AS min_single_entry
FROM "Revenue" r
JOIN  "user"           u  ON u.id = r."employeeId"
LEFT JOIN "Branch"     b  ON b.id = u."branchId"
LEFT JOIN "Company"    co ON co.id = u."companyId"
LEFT JOIN "custom_role" cr ON cr.id = u."customRoleId"
GROUP BY
  r."employeeId", u.name, u."companyId", u."branchId",
  co.name, co.code, b.name, cr.name,
  EXTRACT(YEAR FROM r.date), EXTRACT(MONTH FROM r.date),
  DATE_TRUNC('month', r.date);


-- ============================================================
-- 11. hv_payroll_monthly
--     Full payroll estimate per employee per month.
--     Joins attendance + salary + KPI result.
--
--     Formula:
--       daily_rate           = total_fixed_salary / 24
--       absence_deduction    = (absent×2 + sick×1 + permission×1) × daily_rate
--       late_deduction       = 0  (requires per-minute data not yet stored)
--       kpi_effect           = +bonus for BONUS_CASH/TOP_PERFORMER,
--                              -penalty for PENALTY_DEDUCTION/PENALTY_SATURDAY
--       estimated_take_home  = total_fixed_salary - absence_deduction + kpi_effect
-- ============================================================
CREATE OR REPLACE VIEW hv_payroll_monthly AS
WITH att AS (
  SELECT
    a."userId",
    EXTRACT(YEAR  FROM a.date)::int                                       AS year,
    EXTRACT(MONTH FROM a.date)::int                                       AS month,
    COUNT(*) FILTER (WHERE a.status = 'PRESENT')                         AS present_days,
    COUNT(*) FILTER (WHERE a.status = 'LATE')                            AS late_days,
    COUNT(*) FILTER (WHERE a.status = 'ABSENT')                          AS absent_days,
    COUNT(*) FILTER (WHERE a.status = 'SICK')                            AS sick_days,
    COUNT(*) FILTER (WHERE a.status = 'PERMISSION')                      AS permission_days,
    COUNT(*) FILTER (WHERE a.status = 'HOLIDAY')                         AS holiday_days,
    COUNT(*) FILTER (WHERE a."isLocationSuspect")                        AS suspect_location_days
  FROM "Attendance" a
  GROUP BY a."userId",
           EXTRACT(YEAR FROM a.date),
           EXTRACT(MONTH FROM a.date)
),
base AS (
  SELECT
    u.id                                                                  AS employee_id,
    u.name                                                                AS employee_name,
    u."companyId"                                                         AS company_id,
    COALESCE(co.name, '')                                                 AS company_name,
    COALESCE(co.code, '')                                                 AS company_code,
    u."branchId"                                                          AS branch_id,
    COALESCE(b.name, '')                                                  AS branch_name,
    COALESCE(cr.name, '')                                                 AS role_name,
    att.month,
    att.year,
    -- Salary
    COALESCE(u."baseSalary", 0)::numeric                                 AS base_salary,
    COALESCE(u."mealAllowance", 0)::numeric                              AS meal_allowance,
    COALESCE(u."transportAllowance", 0)::numeric                         AS transport_allowance,
    (COALESCE(u."baseSalary", 0)
      + COALESCE(u."mealAllowance", 0)
      + COALESCE(u."transportAllowance", 0))::numeric                    AS total_gross_fixed,
    -- Attendance counts
    COALESCE(att.present_days, 0)::int                                   AS present_days,
    COALESCE(att.late_days, 0)::int                                      AS late_days,
    COALESCE(att.absent_days, 0)::int                                    AS absent_days,
    COALESCE(att.sick_days, 0)::int                                      AS sick_days,
    COALESCE(att.permission_days, 0)::int                                AS permission_days,
    COALESCE(att.holiday_days, 0)::int                                   AS holiday_days,
    COALESCE(att.suspect_location_days, 0)::int                          AS suspect_location_days,
    -- KPI
    COALESCE(km."totalScore", 0)::numeric                                AS kpi_score,
    COALESCE(km."bonusAmount", 0)::numeric                               AS kpi_bonus_raw,
    km."bonusResult"                                                      AS kpi_bonus_type
  FROM "user" u
  JOIN att ON att."userId" = u.id
  LEFT JOIN "Branch"           b  ON b.id = u."branchId"
  LEFT JOIN "Company"          co ON co.id = u."companyId"
  LEFT JOIN "custom_role"      cr ON cr.id = u."customRoleId"
  LEFT JOIN "KpiMonthlyResult" km ON km."employeeId" = u.id
                                  AND km.month = att.month
                                  AND km.year  = att.year
)
SELECT
  employee_id,
  employee_name,
  company_id,
  company_name,
  company_code,
  branch_id,
  branch_name,
  role_name,
  month,
  year,
  TO_CHAR(
    TO_DATE(year::text || '-' || LPAD(month::text, 2, '0') || '-01', 'YYYY-MM-DD'),
    'YYYY-MM'
  )                                                                       AS period_label,
  -- Salary components
  base_salary,
  meal_allowance,
  transport_allowance,
  total_gross_fixed,
  ROUND(total_gross_fixed / 24, 0)                                        AS daily_rate,
  -- Attendance
  present_days,
  late_days,
  absent_days,
  sick_days,
  permission_days,
  holiday_days,
  suspect_location_days,
  -- Deductions
  0::numeric                                                              AS late_deduction,
  ROUND(
    (absent_days * 2 + sick_days * 1 + permission_days * 1)
    * (total_gross_fixed / 24), 0
  )                                                                       AS absence_deduction,
  ROUND(
    (absent_days * 2 + sick_days * 1 + permission_days * 1)
    * (total_gross_fixed / 24), 0
  )                                                                       AS total_deductions,
  -- KPI
  kpi_score,
  kpi_bonus_raw                                                           AS kpi_bonus,
  kpi_bonus_type,
  CASE kpi_bonus_type
    WHEN 'BONUS_CASH'        THEN 'Bonus Cash'
    WHEN 'SAFE_ZONE'         THEN 'Aman'
    WHEN 'PENALTY_SATURDAY'  THEN 'Denda Sabtu'
    WHEN 'PENALTY_DEDUCTION' THEN 'Potongan'
    WHEN 'TOP_PERFORMER'     THEN 'Top Performer'
    ELSE 'Belum Ada KPI'
  END                                                                     AS kpi_bonus_type_label,
  -- kpi_effect: positive for bonus/top-performer, negative for penalties
  CASE
    WHEN kpi_bonus_type IN ('PENALTY_DEDUCTION', 'PENALTY_SATURDAY')
    THEN -kpi_bonus_raw
    ELSE kpi_bonus_raw
  END                                                                     AS kpi_net_effect,
  -- Estimated take-home
  ROUND(
    total_gross_fixed
    - (absent_days * 2 + sick_days * 1 + permission_days * 1) * (total_gross_fixed / 24)
    + CASE
        WHEN kpi_bonus_type IN ('PENALTY_DEDUCTION', 'PENALTY_SATURDAY')
        THEN -kpi_bonus_raw
        ELSE kpi_bonus_raw
      END
  , 0)                                                                    AS estimated_take_home_pay,
  -- RAG-friendly summary
  CONCAT(
    employee_name, ' (', role_name, ')',
    ' | Periode ', TO_CHAR(
      TO_DATE(year::text || '-' || LPAD(month::text, 2, '0') || '-01', 'YYYY-MM-DD'),
      'Mon YYYY'
    ),
    ' | Hadir ', present_days, ' hari, Terlambat ', late_days,
    ', Absent ', absent_days, ', Sakit ', sick_days,
    ' | Gaji bruto Rp ', TO_CHAR(total_gross_fixed, 'FM999,999,999'),
    ' | Potongan Rp ', TO_CHAR(
      ROUND((absent_days * 2 + sick_days * 1 + permission_days * 1) * (total_gross_fixed / 24), 0),
      'FM999,999,999'
    ),
    ' | KPI ', kpi_score, ' (', COALESCE(kpi_bonus_type::text, '-'), ')',
    ' | Take-home ≈ Rp ', TO_CHAR(
      ROUND(
        total_gross_fixed
        - (absent_days * 2 + sick_days * 1 + permission_days * 1) * (total_gross_fixed / 24)
        + CASE WHEN kpi_bonus_type IN ('PENALTY_DEDUCTION', 'PENALTY_SATURDAY')
               THEN -kpi_bonus_raw ELSE kpi_bonus_raw END
      , 0),
      'FM999,999,999'
    )
  )                                                                       AS context_summary
FROM base;


-- ============================================================
-- 12. hv_bank_accounts
--     Bank accounts with live balance and full org context.
-- ============================================================
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
  ba."branchId"                                                           AS branch_id,
  COALESCE(b.name, '')                                                    AS branch_name,
  b."companyId"                                                           AS company_id,
  COALESCE(co.name, '')                                                   AS company_name,
  COALESCE(co.code, '')                                                   AS company_code,
  cur.code                                                                AS currency_code,
  cur.name                                                                AS currency_name,
  COALESCE(cur.symbol, cur.code)                                          AS currency_symbol,
  ba."createdAt"                                                          AS created_at,
  ba."updatedAt"                                                          AS updated_at
FROM "BankAccount" ba
JOIN  "Branch"   b   ON b.id = ba."branchId"
JOIN  "Currency" cur ON cur.id = ba."currencyId"
LEFT JOIN "Company" co ON co.id = b."companyId";


-- ============================================================
-- 13. hv_bank_balance_by_company
--     Total bank balance grouped by company + currency.
--     Dashboard-ready treasury overview.
-- ============================================================
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
JOIN  "Branch"   b   ON b.id = ba."branchId"
JOIN  "Company"  co  ON co.id = b."companyId"
JOIN  "Currency" cur ON cur.id = ba."currencyId"
GROUP BY co.id, co.name, co.code, cur.code, cur.symbol, cur.name;


-- ============================================================
-- 14. hv_bank_daily
--     Daily bank balance snapshots (closing balance per account per day).
-- ============================================================
CREATE OR REPLACE VIEW hv_bank_daily AS
SELECT
  dbe.id,
  dbe."bankAccountId"                                                     AS bank_account_id,
  ba."bankName"                                                           AS bank_name,
  ba."accountName"                                                        AS account_name,
  ba."branchId"                                                           AS branch_id,
  COALESCE(b.name, '')                                                    AS branch_name,
  b."companyId"                                                           AS company_id,
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
JOIN  "Branch"      b   ON b.id = ba."branchId"
JOIN  "Currency"    cur ON cur.id = ba."currencyId"
LEFT JOIN "Company" co  ON co.id = b."companyId";


-- ============================================================
-- 15. hv_bank_mutations
--     All bank CREDIT/DEBIT transactions with running context.
-- ============================================================
CREATE OR REPLACE VIEW hv_bank_mutations AS
SELECT
  bm.id,
  bm."bankAccountId"                                                      AS bank_account_id,
  ba."bankName"                                                           AS bank_name,
  ba."accountName"                                                        AS account_name,
  ba."branchId"                                                           AS branch_id,
  COALESCE(b.name, '')                                                    AS branch_name,
  b."companyId"                                                           AS company_id,
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
JOIN  "Branch"      b   ON b.id = ba."branchId"
JOIN  "Currency"    cur ON cur.id = ba."currencyId"
LEFT JOIN "Company" co  ON co.id = b."companyId";


-- ============================================================
-- 16. hv_currency_stock
--     Current foreign-currency stock per branch.
--     Includes IDR value estimates at buy, sell, and mid rate.
-- ============================================================
CREATE OR REPLACE VIEW hv_currency_stock AS
SELECT
  cs.id,
  cs."branchId"                                                           AS branch_id,
  COALESCE(b.name, '')                                                    AS branch_name,
  b."companyId"                                                           AS company_id,
  COALESCE(co.name, '')                                                   AS company_name,
  COALESCE(co.code, '')                                                   AS company_code,
  cs."currencyId"                                                         AS currency_id,
  cur.code                                                                AS currency_code,
  cur.name                                                                AS currency_name,
  COALESCE(cur.symbol, cur.code)                                          AS currency_symbol,
  cs.quantity::numeric                                                    AS quantity,
  COALESCE(cs."buyRate", 0)::numeric                                     AS buy_rate,
  COALESCE(cs."sellRate", 0)::numeric                                    AS sell_rate,
  -- IDR value estimates
  ROUND(cs.quantity::numeric * COALESCE(cs."buyRate",  0)::numeric, 0)   AS idr_value_at_buy_rate,
  ROUND(cs.quantity::numeric * COALESCE(cs."sellRate", 0)::numeric, 0)   AS idr_value_at_sell_rate,
  CASE
    WHEN cs."buyRate" IS NOT NULL AND cs."sellRate" IS NOT NULL
    THEN ROUND(cs.quantity::numeric
           * ((cs."buyRate"::numeric + cs."sellRate"::numeric) / 2), 0)
    ELSE NULL
  END                                                                     AS idr_value_at_mid_rate,
  -- Spread in IDR per unit (profitability indicator)
  CASE
    WHEN cs."buyRate" IS NOT NULL AND cs."sellRate" IS NOT NULL
    THEN (cs."sellRate"::numeric - cs."buyRate"::numeric)
    ELSE NULL
  END                                                                     AS spread_per_unit,
  cs."updatedAt"                                                          AS updated_at
FROM "CurrencyStock" cs
JOIN  "Branch"   b   ON b.id = cs."branchId"
JOIN  "Currency" cur ON cur.id = cs."currencyId"
LEFT JOIN "Company" co ON co.id = b."companyId";


-- ============================================================
-- 17. hv_currency_stock_by_company
--     Currency stock totals grouped by company — treasury overview.
-- ============================================================
CREATE OR REPLACE VIEW hv_currency_stock_by_company AS
SELECT
  co.id                                                                   AS company_id,
  co.name                                                                 AS company_name,
  co.code                                                                 AS company_code,
  cur.code                                                                AS currency_code,
  cur.name                                                                AS currency_name,
  COALESCE(cur.symbol, cur.code)                                          AS currency_symbol,
  COUNT(cs.id)                                                            AS branch_count,
  SUM(cs.quantity)::numeric                                               AS total_quantity,
  ROUND(AVG(cs."buyRate")::numeric,  2)                                  AS avg_buy_rate,
  ROUND(AVG(cs."sellRate")::numeric, 2)                                  AS avg_sell_rate,
  ROUND(SUM(cs.quantity::numeric * COALESCE(cs."buyRate",  0)::numeric), 0) AS total_idr_at_buy_rate,
  ROUND(SUM(cs.quantity::numeric * COALESCE(cs."sellRate", 0)::numeric), 0) AS total_idr_at_sell_rate,
  -- Potential gross profit if all stock sold at sell rate vs. acquired at buy rate
  ROUND(
    SUM(cs.quantity::numeric * COALESCE(cs."sellRate", 0)::numeric)
    - SUM(cs.quantity::numeric * COALESCE(cs."buyRate", 0)::numeric)
  , 0)                                                                    AS potential_gross_profit_idr
FROM "CurrencyStock" cs
JOIN  "Branch"   b   ON b.id = cs."branchId"
JOIN  "Company"  co  ON co.id = b."companyId"
JOIN  "Currency" cur ON cur.id = cs."currencyId"
GROUP BY co.id, co.name, co.code, cur.code, cur.name, cur.symbol;


-- ============================================================
-- 18. hv_stock_daily
--     Daily stock entries for all asset types (valas, emas, kas).
-- ============================================================
CREATE OR REPLACE VIEW hv_stock_daily AS
SELECT
  dse.id,
  dse."stockItemId"                                                       AS stock_item_id,
  si.name                                                                 AS stock_item_name,
  COALESCE(si.code, '')                                                   AS stock_item_code,
  si.type                                                                 AS stock_item_type,
  CASE si.type
    WHEN 'CURRENCY' THEN 'Valuta Asing'
    WHEN 'GOLD'     THEN 'Emas'
    WHEN 'SILVER'   THEN 'Perak'
    WHEN 'CASH'     THEN 'Kas'
    ELSE si.type::text
  END                                                                     AS stock_item_type_label,
  si."branchId"                                                           AS branch_id,
  COALESCE(b.name, '')                                                    AS branch_name,
  b."companyId"                                                           AS company_id,
  COALESCE(co.name, '')                                                   AS company_name,
  COALESCE(co.code, '')                                                   AS company_code,
  dse.date,
  EXTRACT(YEAR  FROM dse.date)::int                                       AS year,
  EXTRACT(MONTH FROM dse.date)::int                                       AS month,
  TO_CHAR(dse.date, 'YYYY-MM')                                            AS period_label,
  dse."closingQty"::numeric                                               AS closing_qty,
  COALESCE(dse."rateIdr", 0)::numeric                                    AS rate_idr,
  COALESCE(dse."totalIdr", 0)::numeric                                   AS total_idr,
  dse.qty1::numeric                                                       AS qty1,
  dse.qty2::numeric                                                       AS qty2,
  COALESCE(dse.note, '')                                                  AS note,
  COALESCE(dse."createdBy", '')                                           AS created_by,
  dse."createdAt"                                                         AS created_at
FROM "DailyStockEntry" dse
JOIN  "StockItem"  si  ON si.id = dse."stockItemId"
JOIN  "Branch"     b   ON b.id = si."branchId"
LEFT JOIN "Company" co ON co.id = b."companyId";


-- ============================================================
-- 19. hv_bonus_tiers
--     Bonus matrix tier rules per company per role.
--     Describes the KPI score → result mapping.
-- ============================================================
CREATE OR REPLACE VIEW hv_bonus_tiers AS
SELECT
  bm.id                                                                   AS matrix_id,
  bm."companyId"                                                          AS company_id,
  COALESCE(co.name, '')                                                   AS company_name,
  COALESCE(co.code, '')                                                   AS company_code,
  bm."customRoleId"                                                       AS role_id,
  COALESCE(cr.name, '')                                                   AS role_name,
  bt.id                                                                   AS tier_id,
  bt."minScore"::numeric                                                  AS min_score,
  bt."maxScore"::numeric                                                  AS max_score,
  bt."resultType"                                                         AS result_type,
  CASE bt."resultType"
    WHEN 'BONUS_CASH'        THEN 'Bonus Cash'
    WHEN 'SAFE_ZONE'         THEN 'Aman (Tidak Bonus/Denda)'
    WHEN 'PENALTY_SATURDAY'  THEN 'Denda Masuk Sabtu'
    WHEN 'PENALTY_DEDUCTION' THEN 'Potongan Gaji'
    WHEN 'TOP_PERFORMER'     THEN 'Top Performer'
    ELSE bt."resultType"::text
  END                                                                     AS result_type_label,
  COALESCE(bt.amount, 0)::numeric                                        AS amount,
  bt."isTopPerformer"                                                     AS is_top_performer,
  -- Human-readable tier description for LLM context
  CONCAT(
    'Skor ', bt."minScore"::numeric, '–', bt."maxScore"::numeric,
    ' → ',
    CASE bt."resultType"
      WHEN 'BONUS_CASH'        THEN 'Bonus Cash Rp ' || TO_CHAR(COALESCE(bt.amount, 0)::numeric, 'FM999,999,999')
      WHEN 'SAFE_ZONE'         THEN 'Aman (tidak ada bonus/denda)'
      WHEN 'PENALTY_SATURDAY'  THEN 'Denda masuk Sabtu Rp ' || TO_CHAR(COALESCE(bt.amount, 0)::numeric, 'FM999,999,999')
      WHEN 'PENALTY_DEDUCTION' THEN 'Potongan gaji Rp ' || TO_CHAR(COALESCE(bt.amount, 0)::numeric, 'FM999,999,999')
      WHEN 'TOP_PERFORMER'     THEN 'Top Performer!'
      ELSE bt."resultType"::text
    END
  )                                                                       AS tier_description
FROM "BonusMatrix" bm
JOIN  "BonusTier"    bt ON bt."matrixId" = bm.id
JOIN  "Company"      co ON co.id = bm."companyId"
LEFT JOIN "custom_role" cr ON cr.id = bm."customRoleId";


-- ================================================================
-- GRANT SELECT on all hv_ views to oc_pvi_reader
-- ================================================================
GRANT SELECT ON hv_companies                 TO oc_pvi_reader;
GRANT SELECT ON hv_branches                  TO oc_pvi_reader;
GRANT SELECT ON hv_employees                 TO oc_pvi_reader;
GRANT SELECT ON hv_attendance                TO oc_pvi_reader;
GRANT SELECT ON hv_attendance_monthly        TO oc_pvi_reader;
GRANT SELECT ON hv_kpi_definitions           TO oc_pvi_reader;
GRANT SELECT ON hv_kpi_logs                  TO oc_pvi_reader;
GRANT SELECT ON hv_kpi_monthly               TO oc_pvi_reader;
GRANT SELECT ON hv_revenue                   TO oc_pvi_reader;
GRANT SELECT ON hv_revenue_monthly           TO oc_pvi_reader;
GRANT SELECT ON hv_payroll_monthly           TO oc_pvi_reader;
GRANT SELECT ON hv_bank_accounts             TO oc_pvi_reader;
GRANT SELECT ON hv_bank_balance_by_company   TO oc_pvi_reader;
GRANT SELECT ON hv_bank_daily                TO oc_pvi_reader;
GRANT SELECT ON hv_bank_mutations            TO oc_pvi_reader;
GRANT SELECT ON hv_currency_stock            TO oc_pvi_reader;
GRANT SELECT ON hv_currency_stock_by_company TO oc_pvi_reader;
GRANT SELECT ON hv_stock_daily               TO oc_pvi_reader;
GRANT SELECT ON hv_bonus_tiers               TO oc_pvi_reader;
