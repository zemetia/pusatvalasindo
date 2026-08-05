-- ================================================================
-- OPENCLAW / HERMES SETUP — one-shot script to (re)create the full
-- read-only reporting layer + reader role on a fresh database.
--
-- This mirrors the CURRENT state of the hv_ views as shipped across
-- prisma/migrations (20260627000000_hermes_views onward, including
-- 20260712120000_hermes_views_stockist_kas, the bank-account-by-company
-- rescoping, the DailyBankEntry column changes, the user.companyId
-- removal, 20260722010000_hermes_views_head_confirmation, the KPI redesign
-- 20260728020000, and the payroll rule engine batch 20260805020000 /
-- 20260805040000 / 20260805050000). On an
-- existing database that already ran those migrations, running this
-- script is a safe no-op (CREATE OR REPLACE) other than the reader
-- role bootstrap in apply_openclaw.ts.
--
-- Prefix      : hv_   (hermes_views)
-- Reader user : oc_pvi_reader  (SELECT-only, no auth data)
-- Views       : 31 views covering all business domains
-- ================================================================

-- ============================================================
-- 1. hv_companies
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
LEFT JOIN "user"   u ON u."branchId" = b.id
GROUP BY c.id, c.name, c.code, c."isActive", c."createdAt";


-- ============================================================
-- 2. hv_branches
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
--    A user's PT is derived solely from their branch (no more
--    user.companyId column — dropped in 20260722000000).
--
--    `berkontrak` (0/1) ada di sini karena rule gaji HANYA boleh membaca view
--    hv_*; tanpa kolom ini, aturan "yang masih belum di kontrak belum bisa
--    mendapatkan bonus tambahan" tidak bisa ditulis sebagai rule sama sekali.
--    Sengaja sudah berupa 0/1, bukan tanggal mentah — perbandingan tanggal di
--    dalam rule mudah ditulis salah, dan aturannya sama untuk semua PT. PKWT
--    yang tanggal habisnya sudah lewat dihitung TIDAK berkontrak.
--    Ditambahkan migrasi 20260805020000.
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
  u."employmentStatus"::text                                              AS employment_status,
  CASE u."employmentStatus"
    WHEN 'PKWTT'     THEN 'Karyawan Tetap'
    WHEN 'PKWT'      THEN 'Kontrak (PKWT)'
    WHEN 'PROBATION' THEN 'Masa Percobaan'
    ELSE 'Belum Berkontrak'
  END                                                                     AS employment_status_label,
  u."contractStartDate"::date                                             AS contract_start_date,
  u."contractEndDate"::date                                               AS contract_end_date,
  CASE
    WHEN u."employmentStatus" = 'PKWTT' THEN 1
    WHEN u."employmentStatus" = 'PKWT'
     AND (u."contractEndDate" IS NULL OR u."contractEndDate"::date >= CURRENT_DATE) THEN 1
    ELSE 0
  END                                                                     AS berkontrak,
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
  u."branchId"                                                            AS branch_id,
  COALESCE(b.name, '')                                                    AS branch_name,
  b."companyId"                                                           AS company_id,
  COALESCE(co.name, '')                                                   AS company_name,
  COALESCE(co.code, '')                                                   AS company_code,
  u."customRoleId"                                                        AS role_id,
  COALESCE(cr.name, 'Tanpa Role')                                        AS role_name,
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
    ' | ',
    CASE u."employmentStatus"
      WHEN 'PKWTT'     THEN 'Karyawan Tetap'
      WHEN 'PKWT'      THEN 'Kontrak (PKWT)'
      WHEN 'PROBATION' THEN 'Masa Percobaan'
      ELSE 'Belum Berkontrak'
    END,
    CASE WHEN u."isActive" THEN ' | Aktif' ELSE ' | Tidak Aktif' END
  )                                                                       AS context_summary,
  u."createdAt"                                                           AS created_at
FROM "user" u
LEFT JOIN "Branch"      b  ON b.id = u."branchId"
LEFT JOIN "Company"     co ON co.id = b."companyId"
LEFT JOIN "custom_role" cr ON cr.id = u."customRoleId";


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
    THEN ROUND(EXTRACT(EPOCH FROM (a."checkOut" - a."checkIn"))::numeric / 3600, 2)
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
LEFT JOIN "Company" co ON co.id = b."companyId"
LEFT JOIN "custom_role" cr ON cr.id = u."customRoleId";


-- ============================================================
-- 5. hv_attendance_monthly
-- ============================================================
CREATE OR REPLACE VIEW hv_attendance_monthly AS
SELECT
  a."userId"                                                              AS user_id,
  u.name                                                                  AS employee_name,
  b."companyId"                                                           AS company_id,
  COALESCE(co.name, '')                                                   AS company_name,
  COALESCE(co.code, '')                                                   AS company_code,
  u."branchId"                                                            AS branch_id,
  COALESCE(b.name, '')                                                    AS branch_name,
  COALESCE(cr.name, '')                                                   AS role_name,
  EXTRACT(YEAR  FROM a.date)::int                                         AS year,
  EXTRACT(MONTH FROM a.date)::int                                         AS month,
  TO_CHAR(DATE_TRUNC('month', a.date), 'YYYY-MM')                        AS period_label,
  COUNT(*) FILTER (WHERE a.status = 'PRESENT')                           AS present_days,
  COUNT(*) FILTER (WHERE a.status = 'LATE')                              AS late_days,
  COUNT(*) FILTER (WHERE a.status = 'ABSENT')                            AS absent_days,
  COUNT(*) FILTER (WHERE a.status = 'SICK' AND a."isWithDoctorNote")     AS sick_days_with_note,
  COUNT(*) FILTER (WHERE a.status = 'SICK' AND NOT a."isWithDoctorNote") AS sick_days_no_note,
  COUNT(*) FILTER (WHERE a.status = 'SICK')                              AS sick_days_total,
  COUNT(*) FILTER (WHERE a.status = 'PERMISSION')                        AS permission_days,
  COUNT(*) FILTER (WHERE a.status = 'HOLIDAY')                           AS holiday_days,
  COUNT(*)                                                                AS total_recorded_days,
  COUNT(*) FILTER (WHERE a."isLocationSuspect")                          AS suspect_location_days,
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
LEFT JOIN "Company"    co ON co.id = b."companyId"
LEFT JOIN "custom_role" cr ON cr.id = u."customRoleId"
GROUP BY
  a."userId", u.name, u."branchId", b."companyId",
  co.name, co.code, b.name, cr.name,
  EXTRACT(YEAR FROM a.date), EXTRACT(MONTH FROM a.date),
  DATE_TRUNC('month', a.date);


-- ============================================================
-- 6. hv_kpi_definitions
-- ============================================================
CREATE OR REPLACE VIEW hv_kpi_definitions AS
SELECT
  rk.id,
  kd.id                                                                   AS kpi_id,
  kd.code                                                                 AS kpi_code,
  kd.name                                                                 AS kpi_name,
  COALESCE(kd.objective, '')                                              AS objective,
  COALESCE(kd.description, '')                                            AS description,
  kd."scoringType"                                                        AS scoring_type,
  CASE kd."scoringType"
    WHEN 'TARGET_VALUE'    THEN 'Target Nilai'
    WHEN 'PENALTY_POINT'   THEN 'Penalti Poin per Kejadian'
    WHEN 'REWARD_POINT'    THEN 'Reward Poin per Kejadian'
    WHEN 'PENALTY_PERCENT' THEN 'Penalti Persen per Kejadian'
    WHEN 'TOLERANCE_LIMIT' THEN 'Batas Toleransi'
    WHEN 'BOOLEAN_DAILY'   THEN 'Checklist Harian'
    ELSE kd."scoringType"::text
  END                                                                     AS scoring_type_label,
  kd.unit                                                                 AS unit,
  COALESCE(rk."inputSource", kd."defaultInputSource")                     AS input_source,
  CASE COALESCE(rk."inputSource", kd."defaultInputSource")
    WHEN 'SELF'       THEN 'Diisi karyawan sendiri'
    WHEN 'SUPERVISOR' THEN 'Hanya atasan/HR'
    WHEN 'SYSTEM'     THEN 'Otomatis dari sistem'
  END                                                                     AS input_source_label,
  COALESCE(rk."requiresApproval", kd."defaultRequiresApproval")           AS requires_approval,
  COALESCE(rk."requiresEvidence", kd."defaultRequiresEvidence")           AS requires_evidence,
  rk."companyId"                                                          AS company_id,
  COALESCE(co.name, '')                                                   AS company_name,
  COALESCE(co.code, '')                                                   AS company_code,
  rk."customRoleId"                                                       AS role_id,
  COALESCE(cr.name, '')                                                   AS role_name,
  rk.weight::numeric                                                      AS weight,
  ROUND(
    rk.weight::numeric
    / NULLIF(SUM(rk.weight::numeric) OVER (PARTITION BY rk."companyId", rk."customRoleId"), 0)
    * 100, 2
  )                                                                       AS weight_pct,
  rk."targetValue"::numeric                                               AS target_value,
  rk."basePoint"::numeric                                                 AS base_point,
  rk."pointPerUnit"::numeric                                              AS point_per_unit,
  rk."toleranceLimit"::numeric                                            AS tolerance_limit,
  rk."maxAchievement"::numeric                                            AS max_achievement,
  rk."isActive"                                                           AS is_active,
  kd."createdAt"                                                          AS created_at
FROM "RoleKpi" rk
JOIN  "KpiDefinition"  kd ON kd.id = rk."kpiId"
LEFT JOIN "Company"    co ON co.id = rk."companyId"
LEFT JOIN "custom_role" cr ON cr.id = rk."customRoleId";


-- ============================================================
-- 7. hv_kpi_logs
--    Sumbernya KpiEntry (redesain KPI 20260728020000), bukan KpiLog yang lama.
--
--    `kpi_code`, `branch_id`, dan `role_id` ditambahkan migrasi
--    20260805050000 untuk rule gaji per TIM (cabang + jabatan yang sama), dan
--    tidak satu pun bisa digantikan kolom yang sudah ada:
--
--    • kpi_code — menyaring omzet lewat `kpi_name` berarti mengganti nama KPI
--      di halaman admin diam-diam mematikan rule gaji: query tetap jalan,
--      hasilnya nol, tidak ada error di mana pun. `code` dijamin unik & stabil.
--    • branch_id / role_id — engine menyuntikkan ID, bukan nama. Nama cabang
--      boleh berubah dan nama jabatan berulang di beberapa PT ("Marketing" ada
--      di PVI, PTU, dan PKD), jadi mencocokkan lewat nama akan menggabungkan
--      tim yang bukan satu tim.
-- ============================================================
CREATE OR REPLACE VIEW hv_kpi_logs AS
SELECT
  ke.id,
  ke."employeeId"                                                         AS employee_id,
  u.name                                                                  AS employee_name,
  b."companyId"                                                           AS company_id,
  COALESCE(co.name, '')                                                   AS company_name,
  COALESCE(co.code, '')                                                   AS company_code,
  u."branchId"                                                            AS branch_id,
  COALESCE(b.name, '')                                                    AS branch_name,
  u."customRoleId"                                                        AS role_id,
  COALESCE(cr.name, '')                                                   AS role_name,
  kd.id                                                                   AS kpi_id,
  kd.code                                                                 AS kpi_code,
  kd.name                                                                 AS kpi_name,
  kd."scoringType"                                                        AS scoring_type,
  kd.unit                                                                 AS unit,
  ke.quantity::numeric                                                    AS value,
  ke.quantity::numeric                                                    AS quantity,
  COALESCE(ke.note, '')                                                   AS note,
  ke.source                                                               AS input_source,
  ke.status                                                               AS status,
  CASE ke.status
    WHEN 'PENDING'  THEN 'Menunggu Persetujuan'
    WHEN 'APPROVED' THEN 'Disetujui'
    WHEN 'REJECTED' THEN 'Ditolak'
  END                                                                     AS status_label,
  ke."occurredAt"                                                         AS occurred_at,
  ke."weekOfMonth"                                                        AS week_of_month,
  ke."createdAt"                                                          AS created_at,
  ke."periodYear"                                                         AS year,
  ke."periodMonth"                                                        AS month,
  TO_CHAR(MAKE_DATE(ke."periodYear", ke."periodMonth", 1), 'YYYY-MM')     AS period_label
FROM "KpiEntry" ke
JOIN  "user"           u  ON u.id = ke."employeeId"
JOIN  "RoleKpi"        rk ON rk.id = ke."roleKpiId"
JOIN  "KpiDefinition"  kd ON kd.id = rk."kpiId"
LEFT JOIN "Branch"     b  ON b.id = u."branchId"
LEFT JOIN "Company"    co ON co.id = b."companyId"
LEFT JOIN "custom_role" cr ON cr.id = u."customRoleId";


-- ============================================================
-- 8. hv_kpi_monthly
--    `total_score` adalah PECAHAN (0.86 = 86%), bukan angka 0-100 — rule gaji
--    mencocokkannya sebagai persen bulat lewat ROUND(total_score * 100).
--    Nominal bonus TIDAK ada di sini lagi: konversi skor → uang dilakukan rule
--    engine (PayrollRule), yang butuh peringkat antar-karyawan sehingga tidak
--    bisa diringkas per baris view.
-- ============================================================
CREATE OR REPLACE VIEW hv_kpi_monthly AS
SELECT
  km.id,
  km."employeeId"                                                         AS employee_id,
  u.name                                                                  AS employee_name,
  b."companyId"                                                           AS company_id,
  COALESCE(co.name, '')                                                   AS company_name,
  COALESCE(co.code, '')                                                   AS company_code,
  u."branchId"                                                            AS branch_id,
  COALESCE(b.name, '')                                                    AS branch_name,
  COALESCE(cr.name, '')                                                   AS role_name,
  km.month,
  km.year,
  TO_CHAR(MAKE_DATE(km.year, km.month, 1), 'YYYY-MM')                     AS period_label,
  km."totalScore"::numeric                                                AS total_score,
  ROUND(km."totalScore"::numeric * 100, 2)                                AS total_score_pct,
  km.grade                                                                AS grade,
  CASE km.grade
    WHEN 'A' THEN 'Sangat Baik'
    WHEN 'B' THEN 'Baik'
    WHEN 'C' THEN 'Cukup'
    ELSE 'Perlu Peningkatan'
  END                                                                     AS grade_label,
  kp.status                                                               AS period_status,
  km."breakdownJson"                                                      AS breakdown_json,
  km."calculatedAt"                                                       AS calculated_at,
  CONCAT(
    u.name, ' (', COALESCE(cr.name, '-'), ')',
    ' | KPI ', TO_CHAR(MAKE_DATE(km.year, km.month, 1), 'Mon YYYY'),
    ' | Skor: ', ROUND(km."totalScore"::numeric * 100, 1), '%',
    ' | Grade: ', km.grade
  )                                                                       AS context_summary
FROM "KpiMonthlyResult" km
JOIN  "user"           u  ON u.id = km."employeeId"
LEFT JOIN "KpiPeriod"  kp ON kp."employeeId" = km."employeeId" AND kp.month = km.month AND kp.year = km.year
LEFT JOIN "Branch"     b  ON b.id = u."branchId"
LEFT JOIN "Company"    co ON co.id = b."companyId"
LEFT JOIN "custom_role" cr ON cr.id = u."customRoleId";


-- ============================================================
-- 9. hv_revenue
--    Tabel "Revenue" sudah tidak ada — omzet kini sekadar entri KPI ber-unit
--    CURRENCY (redesain 20260728020000). Nama view dipertahankan supaya tool
--    MCP tidak perlu berubah.
-- ============================================================
CREATE OR REPLACE VIEW hv_revenue AS
SELECT
  ke.id,
  ke."employeeId"                                                         AS employee_id,
  u.name                                                                  AS employee_name,
  b."companyId"                                                           AS company_id,
  COALESCE(co.name, '')                                                   AS company_name,
  COALESCE(co.code, '')                                                   AS company_code,
  u."branchId"                                                            AS branch_id,
  COALESCE(b.name, '')                                                    AS branch_name,
  COALESCE(cr.name, '')                                                   AS role_name,
  kd.name                                                                 AS kpi_name,
  ke.quantity::numeric                                                    AS amount,
  ke."occurredAt"                                                         AS date,
  ke."periodYear"                                                         AS year,
  ke."periodMonth"                                                        AS month,
  TO_CHAR(MAKE_DATE(ke."periodYear", ke."periodMonth", 1), 'YYYY-MM')     AS period_label,
  COALESCE(ke.note, '')                                                   AS note,
  ke."createdAt"                                                          AS created_at
FROM "KpiEntry" ke
JOIN  "RoleKpi"        rk ON rk.id = ke."roleKpiId"
JOIN  "KpiDefinition"  kd ON kd.id = rk."kpiId" AND kd.unit = 'CURRENCY'
JOIN  "user"           u  ON u.id = ke."employeeId"
LEFT JOIN "Branch"     b  ON b.id = u."branchId"
LEFT JOIN "Company"    co ON co.id = b."companyId"
LEFT JOIN "custom_role" cr ON cr.id = u."customRoleId"
WHERE ke.status = 'APPROVED';


-- ============================================================
-- 10. hv_revenue_monthly
--     PERINGATAN: `total_revenue` adalah SUM SELURUH KpiEntry ber-unit
--     CURRENCY, sehingga ia mencampur "Jumlah Omzet", "Net Profit Margin", dan
--     "Kesesuaian Jumlah Kas" — yang terakhir itu SELISIH KAS, bukan omzet.
--     Cukup untuk ringkasan dashboard, TAPI TIDAK BOLEH dipakai menghitung
--     uang. Rule gaji omzet memakai hv_kpi_logs + kpi_code.
-- ============================================================
CREATE OR REPLACE VIEW hv_revenue_monthly AS
SELECT
  ke."employeeId"                                                         AS employee_id,
  u.name                                                                  AS employee_name,
  b."companyId"                                                           AS company_id,
  COALESCE(co.name, '')                                                   AS company_name,
  COALESCE(co.code, '')                                                   AS company_code,
  u."branchId"                                                            AS branch_id,
  COALESCE(b.name, '')                                                    AS branch_name,
  COALESCE(cr.name, '')                                                   AS role_name,
  ke."periodYear"                                                         AS year,
  ke."periodMonth"                                                        AS month,
  TO_CHAR(MAKE_DATE(ke."periodYear", ke."periodMonth", 1), 'YYYY-MM')     AS period_label,
  COUNT(*)                                                                AS transaction_count,
  SUM(ke.quantity)::numeric                                               AS total_revenue,
  ROUND(AVG(ke.quantity)::numeric, 0)                                     AS avg_revenue_per_entry,
  MAX(ke.quantity)::numeric                                               AS max_single_entry,
  MIN(ke.quantity)::numeric                                               AS min_single_entry
FROM "KpiEntry" ke
JOIN  "RoleKpi"        rk ON rk.id = ke."roleKpiId"
JOIN  "KpiDefinition"  kd ON kd.id = rk."kpiId" AND kd.unit = 'CURRENCY'
JOIN  "user"           u  ON u.id = ke."employeeId"
LEFT JOIN "Branch"     b  ON b.id = u."branchId"
LEFT JOIN "Company"    co ON co.id = b."companyId"
LEFT JOIN "custom_role" cr ON cr.id = u."customRoleId"
WHERE ke.status = 'APPROVED'
GROUP BY
  ke."employeeId", u.name, u."branchId", b."companyId",
  co.name, co.code, b.name, cr.name,
  ke."periodYear", ke."periodMonth";


-- ============================================================
-- 11. hv_payroll_monthly
-- ============================================================
CREATE OR REPLACE VIEW hv_payroll_monthly AS
WITH att AS (
  SELECT
    a."userId",
    EXTRACT(YEAR  FROM a.date)::int AS year,
    EXTRACT(MONTH FROM a.date)::int AS month,
    COUNT(*) FILTER (WHERE a.status = 'PRESENT')    AS present_days,
    COUNT(*) FILTER (WHERE a.status = 'LATE')       AS late_days,
    COUNT(*) FILTER (WHERE a.status = 'ABSENT')     AS absent_days,
    COUNT(*) FILTER (WHERE a.status = 'SICK')       AS sick_days,
    COUNT(*) FILTER (WHERE a.status = 'PERMISSION') AS permission_days,
    COUNT(*) FILTER (WHERE a.status = 'HOLIDAY')    AS holiday_days,
    COUNT(*) FILTER (WHERE a."isLocationSuspect")   AS suspect_location_days
  FROM "Attendance" a
  GROUP BY a."userId", EXTRACT(YEAR FROM a.date), EXTRACT(MONTH FROM a.date)
), base AS (
  SELECT
    u.id                                     AS employee_id,
    u.name                                   AS employee_name,
    b."companyId"                            AS company_id,
    COALESCE(co.name, '')                    AS company_name,
    COALESCE(co.code, '')                    AS company_code,
    u."branchId"                             AS branch_id,
    COALESCE(b.name, '')                     AS branch_name,
    COALESCE(cr.name, '')                    AS role_name,
    att.month,
    att.year,
    COALESCE(u."baseSalary", 0)              AS base_salary,
    COALESCE(u."mealAllowance", 0)           AS meal_allowance,
    COALESCE(u."transportAllowance", 0)      AS transport_allowance,
    COALESCE(u."baseSalary", 0) + COALESCE(u."mealAllowance", 0) + COALESCE(u."transportAllowance", 0) AS total_gross_fixed,
    COALESCE(att.present_days, 0)::int          AS present_days,
    COALESCE(att.late_days, 0)::int             AS late_days,
    COALESCE(att.absent_days, 0)::int           AS absent_days,
    COALESCE(att.sick_days, 0)::int             AS sick_days,
    COALESCE(att.permission_days, 0)::int       AS permission_days,
    COALESCE(att.holiday_days, 0)::int          AS holiday_days,
    COALESCE(att.suspect_location_days, 0)::int AS suspect_location_days,
    COALESCE(km."totalScore", 0)::numeric    AS kpi_score,
    COALESCE(km.grade, '-')                  AS kpi_grade
  FROM "user" u
  JOIN att ON att."userId" = u.id
  LEFT JOIN "Branch" b       ON b.id = u."branchId"
  LEFT JOIN "Company" co     ON co.id = b."companyId"
  LEFT JOIN "custom_role" cr ON cr.id = u."customRoleId"
  LEFT JOIN "KpiMonthlyResult" km ON km."employeeId" = u.id AND km.month = att.month AND km.year = att.year
)
SELECT
  employee_id, employee_name, company_id, company_name, company_code,
  branch_id, branch_name, role_name, month, year,
  TO_CHAR(MAKE_DATE(year, month, 1), 'YYYY-MM') AS period_label,
  base_salary, meal_allowance, transport_allowance, total_gross_fixed,
  ROUND(total_gross_fixed / 24, 0)              AS daily_rate,
  present_days, late_days, absent_days, sick_days, permission_days,
  holiday_days, suspect_location_days,
  0::numeric                                    AS late_deduction,
  ROUND((absent_days * 2 + sick_days + permission_days)::numeric * (total_gross_fixed / 24), 0) AS absence_deduction,
  ROUND((absent_days * 2 + sick_days + permission_days)::numeric * (total_gross_fixed / 24), 0) AS total_deductions,
  kpi_score,
  ROUND(kpi_score * 100, 2)                     AS kpi_score_pct,
  kpi_grade,
  ROUND(total_gross_fixed - (absent_days * 2 + sick_days + permission_days)::numeric * (total_gross_fixed / 24), 0) AS estimated_take_home_pay,
  CONCAT(
    employee_name, ' (', role_name, ')',
    ' | Periode ', TO_CHAR(MAKE_DATE(year, month, 1), 'Mon YYYY'),
    ' | Hadir ', present_days, ' hari, Terlambat ', late_days, ', Absent ', absent_days, ', Sakit ', sick_days,
    ' | Gaji bruto Rp ', TO_CHAR(total_gross_fixed, 'FM999,999,999'),
    ' | Potongan Rp ', TO_CHAR(ROUND((absent_days * 2 + sick_days + permission_days)::numeric * (total_gross_fixed / 24), 0), 'FM999,999,999'),
    ' | KPI ', ROUND(kpi_score * 100, 1), '% (grade ', kpi_grade, ')',
    ' | Take-home sebelum insentif ≈ Rp ',
    TO_CHAR(ROUND(total_gross_fixed - (absent_days * 2 + sick_days + permission_days)::numeric * (total_gross_fixed / 24), 0), 'FM999,999,999')
  )                                             AS context_summary
FROM base;


-- ============================================================
-- 12. hv_bank_accounts
--     Bank accounts are scoped per PT (Company), not per branch.
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


-- ============================================================
-- 13. hv_bank_balance_by_company
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
JOIN  "Company"  co  ON co.id = ba."companyId"
JOIN  "Currency" cur ON cur.id = ba."currencyId"
GROUP BY co.id, co.name, co.code, cur.code, cur.symbol, cur.name;


-- ============================================================
-- 14. hv_bank_daily
--     DailyBankEntry no longer has tarikCek (dropped permanently).
-- ============================================================
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


-- ============================================================
-- 15. hv_bank_mutations
-- ============================================================
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


-- ============================================================
-- 16. hv_currency_stock
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
  ROUND(cs.quantity::numeric * COALESCE(cs."buyRate",  0)::numeric, 0)   AS idr_value_at_buy_rate,
  ROUND(cs.quantity::numeric * COALESCE(cs."sellRate", 0)::numeric, 0)   AS idr_value_at_sell_rate,
  CASE
    WHEN cs."buyRate" IS NOT NULL AND cs."sellRate" IS NOT NULL
    THEN ROUND(cs.quantity::numeric
           * ((cs."buyRate"::numeric + cs."sellRate"::numeric) / 2), 0)
    ELSE NULL
  END                                                                     AS idr_value_at_mid_rate,
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
--     Legacy per-branch stock module (predates Stockist/Kas).
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
-- ============================================================
-- Sumbernya PayrollRule + PayrollRuleTier (rule engine). Matriks bonus lama
-- (BonusMatrix/BonusTier, lalu PayrollIncentiveMatrix/Tier) sudah tidak ada;
-- nama kolom kunci dipertahankan supaya MCP tool `get_bonus_tiers` tetap jalan.
--
-- Rule TIDAK punya kolom `type` lagi (dibuang migrasi 20260805040000): arah
-- uang dibaca dari TANDA nominal tiap tier, sama seperti engine
-- (`entryTypeOf`: negatif → denda, selain itu → bonus). Tier bernominal 0
-- diberi label sendiri ("Safe Zone") alih-alih ikut dihitung bonus — band aman
-- adalah kategori nyata di sheet manajemen, dan menampilkannya sebagai
-- "Bonus Rp 0" menyesatkan pembacanya.
CREATE OR REPLACE VIEW hv_bonus_tiers AS
WITH grup AS (
  SELECT r.id            AS rule_id,
         r."ruleKey"     AS rule_key,
         r.version       AS rule_version,
         r.note          AS note,
         r."effectiveFrom"::date AS effective_from,
         r."effectiveTo"::date   AS effective_to,
         g.value         AS grp
  FROM "PayrollRule" r
  CROSS JOIN LATERAL jsonb_array_elements(r.targets::jsonb) AS g(value)
  WHERE r."effectiveTo" IS NULL OR r."effectiveTo"::date >= CURRENT_DATE
),
sasaran AS (
  SELECT gr.*,
         co.id   AS company_id,
         co.name AS company_name,
         co.code AS company_code,
         cr.id   AS role_id,
         cr.name AS role_name
  FROM grup gr
  JOIN "Company" co
    ON (gr.grp -> 'company') = '"*"'::jsonb
    OR (jsonb_typeof(gr.grp -> 'company') = 'array' AND (gr.grp -> 'company') ? co.code)
  JOIN custom_role cr
    ON cr."companyId" = co.id
   AND ((gr.grp -> 'roles') = '"*"'::jsonb
     OR (jsonb_typeof(gr.grp -> 'roles') = 'array' AND (gr.grp -> 'roles') ? cr.name))
)
SELECT
  s.rule_id                                 AS matrix_id,
  s.rule_key,
  s.rule_version,
  s.company_id,
  s.company_name,
  s.company_code,
  s.role_id,
  s.role_name,
  t.id                                      AS tier_id,
  t.min::numeric                            AS min_score,
  t.max::numeric                            AS max_score,
  CASE
    WHEN COALESCE(t.nominal, t."perUnit", 0) < 0 THEN 'DENDA'
    WHEN COALESCE(t.nominal, t."perUnit", 0) > 0 THEN 'BONUS'
    WHEN t.formula IS NOT NULL              THEN 'FORMULA'
    ELSE 'SAFE_ZONE'
  END                                       AS result_type,
  CASE
    WHEN COALESCE(t.nominal, t."perUnit", 0) < 0 THEN 'Denda / Potongan'
    WHEN COALESCE(t.nominal, t."perUnit", 0) > 0 THEN 'Bonus'
    WHEN t.formula IS NOT NULL              THEN 'Dihitung Formula'
    ELSE 'Safe Zone'
  END                                       AS result_label,
  COALESCE(t.nominal, 0)::numeric           AS cash_amount,
  t."perUnit"::numeric                      AS per_unit,
  t."unitField"                             AS unit_field,
  t.formula                                 AS formula,
  t."mandatorySaturday"                     AS mandatory_saturday,
  t."warningLetter"                         AS warning_letter,
  t.label                                   AS tier_label,
  s.effective_from,
  s.effective_to,
  s.note,
  CONCAT(
    COALESCE(s.company_code, '-'), ' | ', COALESCE(s.role_name, '-'),
    ' | ', s.rule_key, '@v', s.rule_version,
    ' | ', COALESCE(t.min::text, '-∞'), '–', COALESCE(t.max::text, '∞'),
    ' → ',
    CASE
      WHEN t.formula IS NOT NULL   THEN 'formula ' || t.formula
      WHEN t."perUnit" IS NOT NULL THEN 'Rp ' || to_char(t."perUnit", 'FM999,999,999') || ' per ' || COALESCE(t."unitField", 'unit')
      ELSE 'Rp ' || to_char(COALESCE(t.nominal, 0), 'FM999,999,999')
    END,
    ' | ', t.label
  )                                         AS context_summary
FROM sasaran s
JOIN "PayrollRuleTier" t ON t."ruleId" = s.rule_id;


-- ============================================================
-- 20. hv_company_stock_items
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


-- ============================================================
-- 29. hv_stockist_head_confirmations
--     Kepala cabang's confirmed stock count vs. the system (teller
--     opname) total for that item/date. See stockist-head-
--     confirmation.service.ts for the app-side equivalent.
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
--     Kepala cabang's confirmed cash total vs. the system (kas
--     pocket) total for that date.
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
-- ============================================================
-- 31. hv_stockist_total_head_confirmations
--     One row per PT per day: the final IDR value kepala cabang
--     assigns to the whole stock (currencies + logam mulia) after
--     re-counting. Quantities stay per item in view 29.
-- ============================================================
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


-- ============================================================
-- 32. hv_bank_head_confirmations
--     Per (PT, date): kepala cabang's re-counted combined bank
--     total vs. the system total (sum of that day's Bank Harian
--     entries across the PT's active accounts).
-- ============================================================
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


-- ============================================================
-- 33. hv_finance_confirmed_daily
--     The finance-ready daily rollup: kepala cabang's confirmed
--     stock + kas + bank totals per PT per day, with a completeness
--     flag. Prefer this over raw system totals for "official"
--     finance figures — it's already cross-checked and ready to use.
-- ============================================================
CREATE OR REPLACE VIEW hv_finance_confirmed_daily AS
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
