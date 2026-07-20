-- ================================================================
-- Fix: employees whose "user"."companyId" is NULL but whose branch has
-- a companyId were showing up with blank company_name/company_code
-- (or being excluded entirely) across every hv_ view that resolves
-- company via the employee row. Same root cause already fixed in
-- hv_employees (see 20260713000000_fix_hv_employees_company_join) —
-- this applies the identical COALESCE(u."companyId", b."companyId")
-- fallback to every other view with the same join pattern.
-- ================================================================

-- ============================================================
-- 4. hv_attendance
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
LEFT JOIN "Company" co ON co.id = COALESCE(u."companyId", b."companyId")
LEFT JOIN "custom_role" cr ON cr.id = u."customRoleId";


-- ============================================================
-- 5. hv_attendance_monthly
-- ============================================================
CREATE OR REPLACE VIEW hv_attendance_monthly AS
SELECT
  a."userId"                                                              AS user_id,
  u.name                                                                  AS employee_name,
  COALESCE(u."companyId", b."companyId")                                  AS company_id,
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
LEFT JOIN "Company"    co ON co.id = COALESCE(u."companyId", b."companyId")
LEFT JOIN "custom_role" cr ON cr.id = u."customRoleId"
GROUP BY
  a."userId", u.name, u."companyId", u."branchId", b."companyId",
  co.name, co.code, b.name, cr.name,
  EXTRACT(YEAR FROM a.date), EXTRACT(MONTH FROM a.date),
  DATE_TRUNC('month', a.date);


-- ============================================================
-- 7. hv_kpi_logs
-- ============================================================
CREATE OR REPLACE VIEW hv_kpi_logs AS
SELECT
  kl.id,
  kl."employeeId"                                                         AS employee_id,
  u.name                                                                  AS employee_name,
  COALESCE(u."companyId", b."companyId")                                  AS company_id,
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
LEFT JOIN "Company"    co ON co.id = COALESCE(u."companyId", b."companyId")
LEFT JOIN "custom_role" cr ON cr.id = u."customRoleId";


-- ============================================================
-- 8. hv_kpi_monthly
-- ============================================================
CREATE OR REPLACE VIEW hv_kpi_monthly AS
SELECT
  km.id,
  km."employeeId"                                                         AS employee_id,
  u.name                                                                  AS employee_name,
  COALESCE(u."companyId", b."companyId")                                  AS company_id,
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
LEFT JOIN "Company"    co ON co.id = COALESCE(u."companyId", b."companyId")
LEFT JOIN "custom_role" cr ON cr.id = u."customRoleId";


-- ============================================================
-- 9. hv_revenue
-- ============================================================
CREATE OR REPLACE VIEW hv_revenue AS
SELECT
  r.id,
  r."employeeId"                                                          AS employee_id,
  u.name                                                                  AS employee_name,
  COALESCE(u."companyId", b."companyId")                                  AS company_id,
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
LEFT JOIN "Company"    co ON co.id = COALESCE(u."companyId", b."companyId")
LEFT JOIN "custom_role" cr ON cr.id = u."customRoleId";


-- ============================================================
-- 10. hv_revenue_monthly
-- ============================================================
CREATE OR REPLACE VIEW hv_revenue_monthly AS
SELECT
  r."employeeId"                                                          AS employee_id,
  u.name                                                                  AS employee_name,
  COALESCE(u."companyId", b."companyId")                                  AS company_id,
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
LEFT JOIN "Company"    co ON co.id = COALESCE(u."companyId", b."companyId")
LEFT JOIN "custom_role" cr ON cr.id = u."customRoleId"
GROUP BY
  r."employeeId", u.name, u."companyId", u."branchId", b."companyId",
  co.name, co.code, b.name, cr.name,
  EXTRACT(YEAR FROM r.date), EXTRACT(MONTH FROM r.date),
  DATE_TRUNC('month', r.date);


-- ============================================================
-- 11. hv_payroll_monthly
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
    COALESCE(u."companyId", b."companyId")                                AS company_id,
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
  LEFT JOIN "Company"          co ON co.id = COALESCE(u."companyId", b."companyId")
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
