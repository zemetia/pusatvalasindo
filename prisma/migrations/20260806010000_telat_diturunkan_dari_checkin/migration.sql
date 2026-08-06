-- Keterlambatan diturunkan dari "checkIn", bukan dibaca dari kolom status.
--
-- Memperbaiki dua cacat yang sampai sekarang masih hidup di dalam view:
--
--  1. `a.status = 'LATE'` sebagai penentu telat. Kolom status ditulis SEKALI
--     saat presensi dicatat, memakai ambang jam masuk yang berlaku detik itu,
--     lalu tidak pernah dihitung ulang. Ia potret, bukan fakta. Sesudah ambang
--     berubah menjadi 07.40, 23 hari yang benar-benar telat masih tersimpan
--     PRESENT dan tidak pernah terhitung, sementara satu hari berjam masuk
--     06.56 tetap tercatat LATE.
--
--  2. `"checkIn" AT TIME ZONE 'Asia/Jakarta'` sendirian. Kolomnya bertipe
--     `timestamp WITHOUT time zone` yang berisi instan UTC polos, jadi bentuk
--     satu-kali itu MENAFSIRKAN nilainya seolah sudah WIB dan menggesernya ke
--     arah sebaliknya — jam masuk 07.48 terbaca 17.48. Yang benar dua tahap:
--     nyatakan dulu bahwa nilainya UTC, baru ubah ke WIB.
--
-- Derivasinya dipusatkan di dua fungsi di bawah supaya tidak ada view yang
-- menuliskan ulang aturannya sendiri — itulah cara cacat ini berkembang biak.

-- Ambang jam masuk sebagai menit-dalam-hari WIB.
--
-- Pasangan dari WORK_START_MINUTES di src/lib/attendance-time.ts. Menjalankan
-- prisma/scripts/apply-jam-masuk.ts akan menulis ulang fungsi ini dari konstanta
-- TypeScript tersebut, jadi mengubah jam masuk tetap cukup di satu tempat.
CREATE OR REPLACE FUNCTION hv_work_start_minutes()
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$ SELECT 7 * 60 + 40 $$;

-- Menit-dalam-hari sebuah check-in menurut WIB.
CREATE OR REPLACE FUNCTION hv_checkin_minutes(check_in timestamp)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE WHEN check_in IS NULL THEN NULL ELSE
    EXTRACT(HOUR   FROM (check_in AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta'))::int * 60 +
    EXTRACT(MINUTE FROM (check_in AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta'))::int
  END
$$;

-- Apakah satu baris presensi terlambat.
--
-- `checkIn` kosong adalah satu-satunya keadaan yang tidak bisa dihitung: hari
-- yang di-set manual oleh HR tanpa jam masuk. Di situ, dan hanya di situ, kolom
-- status dipercaya — karena itu keputusan manusia, bukan potret ambang.
CREATE OR REPLACE FUNCTION hv_is_late(status "AttendanceStatus", check_in timestamp)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN check_in IS NOT NULL THEN hv_checkin_minutes(check_in) > hv_work_start_minutes()
    ELSE status = 'LATE'::"AttendanceStatus"
  END
$$;

-- ── hv_attendance_monthly ──────────────────────────────────────────────────
-- Hanya `present_days` dan `late_days` yang berubah; sisanya identik. Jumlah
-- keduanya tetap sama seperti sebelumnya (semua baris PRESENT/LATE) — yang
-- berubah cuma pembagiannya, dan sekarang pembagian itu mengikuti jam masuk.
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
    count(*) FILTER (WHERE a.status = ANY (ARRAY['PRESENT'::"AttendanceStatus", 'LATE'::"AttendanceStatus"]) AND NOT hv_is_late(a.status, a."checkIn")) AS present_days,
    count(*) FILTER (WHERE a.status = ANY (ARRAY['PRESENT'::"AttendanceStatus", 'LATE'::"AttendanceStatus"]) AND hv_is_late(a.status, a."checkIn")) AS late_days,
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

-- ── hv_payroll_monthly ─────────────────────────────────────────────────────
CREATE OR REPLACE VIEW hv_payroll_monthly AS
 WITH att AS (
         SELECT a."userId",
            EXTRACT(year FROM a.date)::integer AS year,
            EXTRACT(month FROM a.date)::integer AS month,
            count(*) FILTER (WHERE a.status = ANY (ARRAY['PRESENT'::"AttendanceStatus", 'LATE'::"AttendanceStatus"]) AND NOT hv_is_late(a.status, a."checkIn")) AS present_days,
            count(*) FILTER (WHERE a.status = ANY (ARRAY['PRESENT'::"AttendanceStatus", 'LATE'::"AttendanceStatus"]) AND hv_is_late(a.status, a."checkIn")) AS late_days,
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
            -- Tunjangan datang dari UserSalaryComponent sejak migrasi
            -- 20260806000000; kolom u."mealAllowance"/"transportAllowance"
            -- sudah tidak ada lagi di sini.
            COALESCE(u."baseSalary", 0::numeric) AS base_salary,
            hv_user_allowance(u.id, 'Uang Makan') AS meal_allowance,
            hv_user_allowance(u.id, 'Uang Transport') AS transport_allowance,
            COALESCE(u."baseSalary", 0::numeric) + hv_user_allowance(u.id, 'Uang Makan') + hv_user_allowance(u.id, 'Uang Transport') AS total_gross_fixed,
            COALESCE(att.present_days, 0::bigint)::integer AS present_days,
            COALESCE(att.late_days, 0::bigint)::integer AS late_days,
            COALESCE(att.absent_days, 0::bigint)::integer AS absent_days,
            COALESCE(att.sick_days, 0::bigint)::integer AS sick_days,
            COALESCE(att.permission_days, 0::bigint)::integer AS permission_days,
            COALESCE(att.holiday_days, 0::bigint)::integer AS holiday_days,
            COALESCE(att.suspect_location_days, 0::bigint)::integer AS suspect_location_days,
            COALESCE(km."totalScore", 0::numeric) AS kpi_score,
            COALESCE(km.grade, '-'::text) AS kpi_grade
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
    to_char(make_date(year, month, 1)::timestamp with time zone, 'YYYY-MM'::text) AS period_label,
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
    round((absent_days * 2 + sick_days + permission_days)::numeric * (total_gross_fixed / 24::numeric), 0) AS absence_deduction,
    round((absent_days * 2 + sick_days + permission_days)::numeric * (total_gross_fixed / 24::numeric), 0) AS total_deductions,
    kpi_score,
    round(kpi_score * 100::numeric, 2) AS kpi_score_pct,
    kpi_grade,
    round(total_gross_fixed - (absent_days * 2 + sick_days + permission_days)::numeric * (total_gross_fixed / 24::numeric), 0) AS estimated_take_home_pay,
    concat(employee_name, ' (', role_name, ')', ' | Periode ', to_char(make_date(year, month, 1)::timestamp with time zone, 'Mon YYYY'::text), ' | Hadir ', present_days, ' hari, Terlambat ', late_days, ', Absent ', absent_days, ', Sakit ', sick_days, ' | Gaji bruto Rp ', to_char(total_gross_fixed, 'FM999,999,999'::text), ' | Potongan Rp ', to_char(round((absent_days * 2 + sick_days + permission_days)::numeric * (total_gross_fixed / 24::numeric), 0), 'FM999,999,999'::text), ' | KPI ', round(kpi_score * 100::numeric, 1), '% (grade ', kpi_grade, ')', ' | Take-home sebelum insentif ≈ Rp ', to_char(round(total_gross_fixed - (absent_days * 2 + sick_days + permission_days)::numeric * (total_gross_fixed / 24::numeric), 0), 'FM999,999,999'::text)) AS context_summary
   FROM base;

-- Koneksi read-only rule engine (DATABASE_VIEW_ONLY_URL) memanggil fungsi ini
-- lewat view di atas. Postgres memang memberi EXECUTE ke PUBLIC secara default,
-- tapi itu ditulis eksplisit di sini supaya tetap benar kalau default tersebut
-- pernah dicabut — rule yang gagal karena izin akan tampil sebagai "query gagal"
-- pada slip, bukan sebagai masalah migrasi.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'oc_pvi_reader') THEN
    GRANT EXECUTE ON FUNCTION hv_work_start_minutes() TO oc_pvi_reader;
    GRANT EXECUTE ON FUNCTION hv_checkin_minutes(timestamp) TO oc_pvi_reader;
    GRANT EXECUTE ON FUNCTION hv_is_late("AttendanceStatus", timestamp) TO oc_pvi_reader;
  END IF;
END $$;
