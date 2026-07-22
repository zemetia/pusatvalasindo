-- A user's PT is now derived solely from their branch (single source of truth).
-- The Hermes (hv_*) views that resolved company via COALESCE(u."companyId", b."companyId")
-- are redefined to use the branch's company only, then the redundant user.companyId
-- column, its FK, and its index are dropped.

-- hv_companies
CREATE OR REPLACE VIEW hv_companies AS
SELECT c.id,
    c.name AS company_name,
    c.code AS company_code,
    c."isActive" AS is_active,
        CASE
            WHEN c."isActive" THEN 'Aktif'::text
            ELSE 'Tidak Aktif'::text
        END AS status_label,
    count(DISTINCT b.id) FILTER (WHERE b."isActive") AS active_branch_count,
    count(DISTINCT b.id) AS total_branch_count,
    count(DISTINCT u.id) FILTER (WHERE u."isActive") AS active_employee_count,
    count(DISTINCT u.id) AS total_employee_count,
    c."createdAt" AS created_at
   FROM "Company" c
     LEFT JOIN "Branch" b ON b."companyId" = c.id
     LEFT JOIN "user" u ON u."branchId" = b.id
  GROUP BY c.id, c.name, c.code, c."isActive", c."createdAt";

-- hv_employees
CREATE OR REPLACE VIEW hv_employees AS
SELECT u.id,
    u.name,
    u.email,
    COALESCE(u.phone, ''::text) AS phone,
    u."isActive" AS is_active,
        CASE
            WHEN u."isActive" THEN 'Aktif'::text
            ELSE 'Tidak Aktif'::text
        END AS status_label,
    u."joinDate"::date AS join_date,
    COALESCE(u."baseSalary", 0::numeric) AS base_salary,
    COALESCE(u."mealAllowance", 0::numeric) AS meal_allowance,
    COALESCE(u."transportAllowance", 0::numeric) AS transport_allowance,
    COALESCE(u."baseSalary", 0::numeric) + COALESCE(u."mealAllowance", 0::numeric) + COALESCE(u."transportAllowance", 0::numeric) AS total_fixed_salary,
    round((COALESCE(u."baseSalary", 0::numeric) + COALESCE(u."mealAllowance", 0::numeric) + COALESCE(u."transportAllowance", 0::numeric)) / 24::numeric, 0) AS daily_rate,
    u."branchId" AS branch_id,
    COALESCE(b.name, ''::text) AS branch_name,
    b."companyId" AS company_id,
    COALESCE(co.name, ''::text) AS company_name,
    COALESCE(co.code, ''::text) AS company_code,
    u."customRoleId" AS role_id,
    COALESCE(cr.name, 'Tanpa Role'::text) AS role_name,
    concat(u.name, ' — ', COALESCE(cr.name, 'Tanpa Role'::text), ' di ', COALESCE(co.name, 'PT tidak diketahui'::text), ' cabang ', COALESCE(b.name, 'tidak diketahui'::text), ' | Gaji pokok Rp ', to_char(COALESCE(u."baseSalary", 0::numeric), 'FM999,999,999'::text), ' | Total tetap Rp ', to_char(COALESCE(u."baseSalary", 0::numeric) + COALESCE(u."mealAllowance", 0::numeric) + COALESCE(u."transportAllowance", 0::numeric), 'FM999,999,999'::text),
        CASE
            WHEN u."isActive" THEN ' | Aktif'::text
            ELSE ' | Tidak Aktif'::text
        END) AS context_summary,
    u."createdAt" AS created_at
   FROM "user" u
     LEFT JOIN "Branch" b ON b.id = u."branchId"
     LEFT JOIN "Company" co ON co.id = b."companyId"
     LEFT JOIN custom_role cr ON cr.id = u."customRoleId";

-- hv_attendance
CREATE OR REPLACE VIEW hv_attendance AS
SELECT a.id,
    a."userId" AS user_id,
    u.name AS employee_name,
    COALESCE(co.name, ''::text) AS company_name,
    COALESCE(co.code, ''::text) AS company_code,
    COALESCE(b.name, ''::text) AS branch_name,
    COALESCE(cr.name, ''::text) AS role_name,
    a.date,
    EXTRACT(year FROM a.date)::integer AS year,
    EXTRACT(month FROM a.date)::integer AS month,
    to_char(a.date::timestamp with time zone, 'YYYY-MM'::text) AS period_label,
    a."checkIn",
    a."checkOut",
        CASE
            WHEN a."checkIn" IS NOT NULL AND a."checkOut" IS NOT NULL THEN round(EXTRACT(epoch FROM a."checkOut" - a."checkIn") / 3600::numeric, 2)
            ELSE NULL::numeric
        END AS work_hours,
    a.status,
        CASE a.status
            WHEN 'PRESENT'::"AttendanceStatus" THEN 'Hadir'::text
            WHEN 'LATE'::"AttendanceStatus" THEN 'Terlambat'::text
            WHEN 'ABSENT'::"AttendanceStatus" THEN 'Tidak Hadir'::text
            WHEN 'PERMISSION'::"AttendanceStatus" THEN 'Izin'::text
            WHEN 'SICK'::"AttendanceStatus" THEN 'Sakit'::text
            WHEN 'HOLIDAY'::"AttendanceStatus" THEN 'Libur'::text
            ELSE a.status::text
        END AS status_label,
    a."isLocationSuspect" AS is_location_suspect,
    a."isWithDoctorNote" AS is_with_doctor_note,
    COALESCE(a.notes, ''::text) AS notes,
    a."createdAt" AS created_at
   FROM "Attendance" a
     JOIN "user" u ON u.id = a."userId"
     LEFT JOIN "Branch" b ON b.id = a."branchId"
     LEFT JOIN "Company" co ON co.id = b."companyId"
     LEFT JOIN custom_role cr ON cr.id = u."customRoleId";

-- hv_attendance_monthly
CREATE OR REPLACE VIEW hv_attendance_monthly AS
SELECT a."userId" AS user_id,
    u.name AS employee_name,
    b."companyId" AS company_id,
    COALESCE(co.name, ''::text) AS company_name,
    COALESCE(co.code, ''::text) AS company_code,
    u."branchId" AS branch_id,
    COALESCE(b.name, ''::text) AS branch_name,
    COALESCE(cr.name, ''::text) AS role_name,
    EXTRACT(year FROM a.date)::integer AS year,
    EXTRACT(month FROM a.date)::integer AS month,
    to_char(date_trunc('month'::text, a.date::timestamp with time zone), 'YYYY-MM'::text) AS period_label,
    count(*) FILTER (WHERE a.status = 'PRESENT'::"AttendanceStatus") AS present_days,
    count(*) FILTER (WHERE a.status = 'LATE'::"AttendanceStatus") AS late_days,
    count(*) FILTER (WHERE a.status = 'ABSENT'::"AttendanceStatus") AS absent_days,
    count(*) FILTER (WHERE a.status = 'SICK'::"AttendanceStatus" AND a."isWithDoctorNote") AS sick_days_with_note,
    count(*) FILTER (WHERE a.status = 'SICK'::"AttendanceStatus" AND NOT a."isWithDoctorNote") AS sick_days_no_note,
    count(*) FILTER (WHERE a.status = 'SICK'::"AttendanceStatus") AS sick_days_total,
    count(*) FILTER (WHERE a.status = 'PERMISSION'::"AttendanceStatus") AS permission_days,
    count(*) FILTER (WHERE a.status = 'HOLIDAY'::"AttendanceStatus") AS holiday_days,
    count(*) AS total_recorded_days,
    count(*) FILTER (WHERE a."isLocationSuspect") AS suspect_location_days,
    round(sum(
        CASE
            WHEN a."checkIn" IS NOT NULL AND a."checkOut" IS NOT NULL THEN EXTRACT(epoch FROM a."checkOut" - a."checkIn") / 3600::numeric
            ELSE 0::numeric
        END), 2) AS total_work_hours,
    round(avg(
        CASE
            WHEN a."checkIn" IS NOT NULL AND a."checkOut" IS NOT NULL THEN EXTRACT(epoch FROM a."checkOut" - a."checkIn") / 3600::numeric
            ELSE NULL::numeric
        END), 2) AS avg_work_hours_per_day
   FROM "Attendance" a
     JOIN "user" u ON u.id = a."userId"
     LEFT JOIN "Branch" b ON b.id = u."branchId"
     LEFT JOIN "Company" co ON co.id = b."companyId"
     LEFT JOIN custom_role cr ON cr.id = u."customRoleId"
  GROUP BY a."userId", u.name, u."branchId", b."companyId", co.name, co.code, b.name, cr.name, (EXTRACT(year FROM a.date)), (EXTRACT(month FROM a.date)), (date_trunc('month'::text, a.date::timestamp with time zone));

-- hv_kpi_logs
CREATE OR REPLACE VIEW hv_kpi_logs AS
SELECT kl.id,
    kl."employeeId" AS employee_id,
    u.name AS employee_name,
    b."companyId" AS company_id,
    COALESCE(co.name, ''::text) AS company_name,
    COALESCE(co.code, ''::text) AS company_code,
    COALESCE(b.name, ''::text) AS branch_name,
    COALESCE(cr.name, ''::text) AS role_name,
    kl."kpiId" AS kpi_id,
    kd.name AS kpi_name,
    kd.type AS kpi_type,
        CASE kd.type
            WHEN 'EVENT'::"KpiType" THEN 'Event / Kejadian'::text
            WHEN 'TARGET'::"KpiType" THEN 'Target Nilai'::text
            ELSE kd.type::text
        END AS kpi_type_label,
    kl.value::numeric AS value,
    COALESCE(kl.note, ''::text) AS note,
    kl."createdAt" AS created_at,
    EXTRACT(year FROM kl."createdAt")::integer AS year,
    EXTRACT(month FROM kl."createdAt")::integer AS month,
    to_char(kl."createdAt", 'YYYY-MM'::text) AS period_label
   FROM "KpiLog" kl
     JOIN "user" u ON u.id = kl."employeeId"
     JOIN "KpiDefinition" kd ON kd.id = kl."kpiId"
     LEFT JOIN "Branch" b ON b.id = u."branchId"
     LEFT JOIN "Company" co ON co.id = b."companyId"
     LEFT JOIN custom_role cr ON cr.id = u."customRoleId";

-- hv_kpi_monthly
CREATE OR REPLACE VIEW hv_kpi_monthly AS
SELECT km.id,
    km."employeeId" AS employee_id,
    u.name AS employee_name,
    b."companyId" AS company_id,
    COALESCE(co.name, ''::text) AS company_name,
    COALESCE(co.code, ''::text) AS company_code,
    u."branchId" AS branch_id,
    COALESCE(b.name, ''::text) AS branch_name,
    COALESCE(cr.name, ''::text) AS role_name,
    km.month,
    km.year,
    to_char(to_date(((km.year::text || '-'::text) || lpad(km.month::text, 2, '0'::text)) || '-01'::text, 'YYYY-MM-DD'::text)::timestamp with time zone, 'YYYY-MM'::text) AS period_label,
    km."totalScore"::numeric AS total_score,
        CASE
            WHEN km."totalScore" >= 90::numeric THEN 'A'::text
            WHEN km."totalScore" >= 75::numeric THEN 'B'::text
            WHEN km."totalScore" >= 60::numeric THEN 'C'::text
            ELSE 'D'::text
        END AS grade,
        CASE
            WHEN km."totalScore" >= 90::numeric THEN 'Sangat Baik'::text
            WHEN km."totalScore" >= 75::numeric THEN 'Baik'::text
            WHEN km."totalScore" >= 60::numeric THEN 'Cukup'::text
            ELSE 'Perlu Peningkatan'::text
        END AS grade_label,
    COALESCE(km."bonusAmount", 0::numeric) AS bonus_amount,
    km."bonusResult" AS bonus_result,
        CASE km."bonusResult"
            WHEN 'BONUS_CASH'::"BonusResultType" THEN 'Bonus Cash'::text
            WHEN 'SAFE_ZONE'::"BonusResultType" THEN 'Aman (Tidak Bonus/Denda)'::text
            WHEN 'PENALTY_SATURDAY'::"BonusResultType" THEN 'Denda Masuk Sabtu'::text
            WHEN 'PENALTY_DEDUCTION'::"BonusResultType" THEN 'Potongan Gaji'::text
            WHEN 'TOP_PERFORMER'::"BonusResultType" THEN 'Top Performer'::text
            ELSE 'Belum Dihitung'::text
        END AS bonus_result_label,
    km."breakdownJson" AS breakdown_json,
    km."calculatedAt" AS calculated_at,
    concat(u.name, ' (', COALESCE(cr.name, '-'::text), ')', ' | KPI ', to_char(to_date(((km.year::text || '-'::text) || lpad(km.month::text, 2, '0'::text)) || '-01'::text, 'YYYY-MM-DD'::text)::timestamp with time zone, 'Mon YYYY'::text), ' | Skor: ', km."totalScore"::numeric, ' | Grade: ',
        CASE
            WHEN km."totalScore" >= 90::numeric THEN 'A'::text
            WHEN km."totalScore" >= 75::numeric THEN 'B'::text
            WHEN km."totalScore" >= 60::numeric THEN 'C'::text
            ELSE 'D'::text
        END, ' | ',
        CASE km."bonusResult"
            WHEN 'BONUS_CASH'::"BonusResultType" THEN 'Bonus Cash Rp '::text || to_char(COALESCE(km."bonusAmount", 0::numeric), 'FM999,999,999'::text)
            WHEN 'SAFE_ZONE'::"BonusResultType" THEN 'Aman'::text
            WHEN 'PENALTY_SATURDAY'::"BonusResultType" THEN 'Denda Sabtu'::text
            WHEN 'PENALTY_DEDUCTION'::"BonusResultType" THEN 'Potongan Rp '::text || to_char(COALESCE(km."bonusAmount", 0::numeric), 'FM999,999,999'::text)
            WHEN 'TOP_PERFORMER'::"BonusResultType" THEN 'Top Performer!'::text
            ELSE 'Belum Ada Hasil'::text
        END) AS context_summary
   FROM "KpiMonthlyResult" km
     JOIN "user" u ON u.id = km."employeeId"
     LEFT JOIN "Branch" b ON b.id = u."branchId"
     LEFT JOIN "Company" co ON co.id = b."companyId"
     LEFT JOIN custom_role cr ON cr.id = u."customRoleId";

-- hv_revenue
CREATE OR REPLACE VIEW hv_revenue AS
SELECT r.id,
    r."employeeId" AS employee_id,
    u.name AS employee_name,
    b."companyId" AS company_id,
    COALESCE(co.name, ''::text) AS company_name,
    COALESCE(co.code, ''::text) AS company_code,
    u."branchId" AS branch_id,
    COALESCE(b.name, ''::text) AS branch_name,
    COALESCE(cr.name, ''::text) AS role_name,
    r.amount::numeric AS amount,
    r.date,
    EXTRACT(year FROM r.date)::integer AS year,
    EXTRACT(month FROM r.date)::integer AS month,
    to_char(r.date::timestamp with time zone, 'YYYY-MM'::text) AS period_label,
    COALESCE(r.note, ''::text) AS note,
    r."createdAt" AS created_at
   FROM "Revenue" r
     JOIN "user" u ON u.id = r."employeeId"
     LEFT JOIN "Branch" b ON b.id = u."branchId"
     LEFT JOIN "Company" co ON co.id = b."companyId"
     LEFT JOIN custom_role cr ON cr.id = u."customRoleId";

-- hv_revenue_monthly
CREATE OR REPLACE VIEW hv_revenue_monthly AS
SELECT r."employeeId" AS employee_id,
    u.name AS employee_name,
    b."companyId" AS company_id,
    COALESCE(co.name, ''::text) AS company_name,
    COALESCE(co.code, ''::text) AS company_code,
    u."branchId" AS branch_id,
    COALESCE(b.name, ''::text) AS branch_name,
    COALESCE(cr.name, ''::text) AS role_name,
    EXTRACT(year FROM r.date)::integer AS year,
    EXTRACT(month FROM r.date)::integer AS month,
    to_char(date_trunc('month'::text, r.date::timestamp with time zone), 'YYYY-MM'::text) AS period_label,
    count(*) AS transaction_count,
    sum(r.amount) AS total_revenue,
    round(avg(r.amount), 0) AS avg_revenue_per_entry,
    max(r.amount) AS max_single_entry,
    min(r.amount) AS min_single_entry
   FROM "Revenue" r
     JOIN "user" u ON u.id = r."employeeId"
     LEFT JOIN "Branch" b ON b.id = u."branchId"
     LEFT JOIN "Company" co ON co.id = b."companyId"
     LEFT JOIN custom_role cr ON cr.id = u."customRoleId"
  GROUP BY r."employeeId", u.name, u."branchId", b."companyId", co.name, co.code, b.name, cr.name, (EXTRACT(year FROM r.date)), (EXTRACT(month FROM r.date)), (date_trunc('month'::text, r.date::timestamp with time zone));

-- hv_payroll_monthly
CREATE OR REPLACE VIEW hv_payroll_monthly AS
WITH att AS (
         SELECT a."userId",
            EXTRACT(year FROM a.date)::integer AS year,
            EXTRACT(month FROM a.date)::integer AS month,
            count(*) FILTER (WHERE a.status = 'PRESENT'::"AttendanceStatus") AS present_days,
            count(*) FILTER (WHERE a.status = 'LATE'::"AttendanceStatus") AS late_days,
            count(*) FILTER (WHERE a.status = 'ABSENT'::"AttendanceStatus") AS absent_days,
            count(*) FILTER (WHERE a.status = 'SICK'::"AttendanceStatus") AS sick_days,
            count(*) FILTER (WHERE a.status = 'PERMISSION'::"AttendanceStatus") AS permission_days,
            count(*) FILTER (WHERE a.status = 'HOLIDAY'::"AttendanceStatus") AS holiday_days,
            count(*) FILTER (WHERE a."isLocationSuspect") AS suspect_location_days
           FROM "Attendance" a
          GROUP BY a."userId", (EXTRACT(year FROM a.date)), (EXTRACT(month FROM a.date))
        ), base AS (
         SELECT u.id AS employee_id,
            u.name AS employee_name,
            b."companyId" AS company_id,
            COALESCE(co.name, ''::text) AS company_name,
            COALESCE(co.code, ''::text) AS company_code,
            u."branchId" AS branch_id,
            COALESCE(b.name, ''::text) AS branch_name,
            COALESCE(cr.name, ''::text) AS role_name,
            att.month,
            att.year,
            COALESCE(u."baseSalary", 0::numeric) AS base_salary,
            COALESCE(u."mealAllowance", 0::numeric) AS meal_allowance,
            COALESCE(u."transportAllowance", 0::numeric) AS transport_allowance,
            COALESCE(u."baseSalary", 0::numeric) + COALESCE(u."mealAllowance", 0::numeric) + COALESCE(u."transportAllowance", 0::numeric) AS total_gross_fixed,
            COALESCE(att.present_days, 0::bigint)::integer AS present_days,
            COALESCE(att.late_days, 0::bigint)::integer AS late_days,
            COALESCE(att.absent_days, 0::bigint)::integer AS absent_days,
            COALESCE(att.sick_days, 0::bigint)::integer AS sick_days,
            COALESCE(att.permission_days, 0::bigint)::integer AS permission_days,
            COALESCE(att.holiday_days, 0::bigint)::integer AS holiday_days,
            COALESCE(att.suspect_location_days, 0::bigint)::integer AS suspect_location_days,
            COALESCE(km."totalScore", 0::numeric) AS kpi_score,
            COALESCE(km."bonusAmount", 0::numeric) AS kpi_bonus_raw,
            km."bonusResult" AS kpi_bonus_type
           FROM "user" u
             JOIN att ON att."userId" = u.id
             LEFT JOIN "Branch" b ON b.id = u."branchId"
             LEFT JOIN "Company" co ON co.id = b."companyId"
             LEFT JOIN custom_role cr ON cr.id = u."customRoleId"
             LEFT JOIN "KpiMonthlyResult" km ON km."employeeId" = u.id AND km.month = att.month AND km.year = att.year
        )
 SELECT employee_id,
    employee_name,
    company_id,
    company_name,
    company_code,
    branch_id,
    branch_name,
    role_name,
    month,
    year,
    to_char(to_date(((year::text || '-'::text) || lpad(month::text, 2, '0'::text)) || '-01'::text, 'YYYY-MM-DD'::text)::timestamp with time zone, 'YYYY-MM'::text) AS period_label,
    base_salary,
    meal_allowance,
    transport_allowance,
    total_gross_fixed,
    round(total_gross_fixed / 24::numeric, 0) AS daily_rate,
    present_days,
    late_days,
    absent_days,
    sick_days,
    permission_days,
    holiday_days,
    suspect_location_days,
    0::numeric AS late_deduction,
    round((absent_days * 2 + sick_days * 1 + permission_days * 1)::numeric * (total_gross_fixed / 24::numeric), 0) AS absence_deduction,
    round((absent_days * 2 + sick_days * 1 + permission_days * 1)::numeric * (total_gross_fixed / 24::numeric), 0) AS total_deductions,
    kpi_score,
    kpi_bonus_raw AS kpi_bonus,
    kpi_bonus_type,
        CASE kpi_bonus_type
            WHEN 'BONUS_CASH'::"BonusResultType" THEN 'Bonus Cash'::text
            WHEN 'SAFE_ZONE'::"BonusResultType" THEN 'Aman'::text
            WHEN 'PENALTY_SATURDAY'::"BonusResultType" THEN 'Denda Sabtu'::text
            WHEN 'PENALTY_DEDUCTION'::"BonusResultType" THEN 'Potongan'::text
            WHEN 'TOP_PERFORMER'::"BonusResultType" THEN 'Top Performer'::text
            ELSE 'Belum Ada KPI'::text
        END AS kpi_bonus_type_label,
        CASE
            WHEN kpi_bonus_type = ANY (ARRAY['PENALTY_DEDUCTION'::"BonusResultType", 'PENALTY_SATURDAY'::"BonusResultType"]) THEN - kpi_bonus_raw
            ELSE kpi_bonus_raw
        END AS kpi_net_effect,
    round(total_gross_fixed - (absent_days * 2 + sick_days * 1 + permission_days * 1)::numeric * (total_gross_fixed / 24::numeric) +
        CASE
            WHEN kpi_bonus_type = ANY (ARRAY['PENALTY_DEDUCTION'::"BonusResultType", 'PENALTY_SATURDAY'::"BonusResultType"]) THEN - kpi_bonus_raw
            ELSE kpi_bonus_raw
        END, 0) AS estimated_take_home_pay,
    concat(employee_name, ' (', role_name, ')', ' | Periode ', to_char(to_date(((year::text || '-'::text) || lpad(month::text, 2, '0'::text)) || '-01'::text, 'YYYY-MM-DD'::text)::timestamp with time zone, 'Mon YYYY'::text), ' | Hadir ', present_days, ' hari, Terlambat ', late_days, ', Absent ', absent_days, ', Sakit ', sick_days, ' | Gaji bruto Rp ', to_char(total_gross_fixed, 'FM999,999,999'::text), ' | Potongan Rp ', to_char(round((absent_days * 2 + sick_days * 1 + permission_days * 1)::numeric * (total_gross_fixed / 24::numeric), 0), 'FM999,999,999'::text), ' | KPI ', kpi_score, ' (', COALESCE(kpi_bonus_type::text, '-'::text), ')', ' | Take-home ≈ Rp ', to_char(round(total_gross_fixed - (absent_days * 2 + sick_days * 1 + permission_days * 1)::numeric * (total_gross_fixed / 24::numeric) +
        CASE
            WHEN kpi_bonus_type = ANY (ARRAY['PENALTY_DEDUCTION'::"BonusResultType", 'PENALTY_SATURDAY'::"BonusResultType"]) THEN - kpi_bonus_raw
            ELSE kpi_bonus_raw
        END, 0), 'FM999,999,999'::text)) AS context_summary
   FROM base;

-- DropForeignKey (already dropped in the failed first attempt; guard with IF EXISTS)
ALTER TABLE "user" DROP CONSTRAINT IF EXISTS "user_companyId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "user_companyId_idx";

-- AlterTable
ALTER TABLE "user" DROP COLUMN "companyId";
