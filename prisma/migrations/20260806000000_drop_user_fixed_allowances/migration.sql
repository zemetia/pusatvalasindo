-- Uang makan/transport/jabatan dan BPJS pindah dari kolom tetap "user" ke
-- SalaryComponent/UserSalaryComponent, supaya sejalan dengan komponen gaji
-- lainnya (lihat komentar di prisma/schema/payroll.prisma). Nilai yang sudah
-- diisi per karyawan dipindahkan dulu sebelum kolomnya dihapus — kalau
-- langsung DROP COLUMN, seluruh nominal yang sudah disetel admin hilang.
--
-- ── Kenapa versi ini berbeda dari versi pertama ──────────────────────────────
-- Versi pertama gagal di produksi dengan 23505 (duplicate key pada
-- UserSalaryComponent_userId_componentId_key). Sebabnya: ia menganggap dirinya
-- satu-satunya yang pernah memindahkan data. Padahal komponen "Uang Makan" dkk
-- SUDAH dibuat aplikasi/seeder lebih dulu beserta seluruh assignment-nya, jadi:
--
--   • tahap 1 menambah komponen KEDUA dengan nama sama (id UUID, bukan cuid),
--   • tahap 2 mencoba menyisipkan assignment yang sudah ada → tabrakan.
--
-- Yang lebih berbahaya: tahap 1 sempat commit sebelum tahap 2 gagal, sehingga
-- database meninggalkan empat komponen duplikat tanpa assignment. Versi ini
-- membereskannya dan dibuat aman dijalankan berulang kali.
--
-- Nilai kolom lama di produksi ternyata hanya penanda (angka 1), sementara
-- nominal sebenarnya sudah ada di UserSalaryComponent. Karena itu backfill di
-- bawah memakai ON CONFLICT DO NOTHING: yang sudah ada TIDAK BOLEH ditimpa —
-- menimpanya justru akan mengganti tunjangan Rp 1.357.000 menjadi Rp 1.

-- 0. Bersihkan sisa percobaan yang gagal: komponen duplikat yang tidak dipakai
--    siapa pun. Dipagari `NOT EXISTS` supaya tidak mungkin menghapus komponen
--    yang sudah punya assignment, apa pun bentuk id-nya.
DELETE FROM "SalaryComponent" sc
WHERE sc."companyId" IS NULL
  AND sc."name" IN ('Uang Makan', 'Uang Transport', 'Uang Jabatan', 'BPJS Kesehatan')
  AND NOT EXISTS (
    SELECT 1 FROM "UserSalaryComponent" u WHERE u."componentId" = sc."id"
  )
  AND EXISTS (
    -- Hanya buang kalau MASIH ADA komponen lain bernama sama yang dipakai —
    -- jangan sampai database yang memang baru justru kehilangan komponennya.
    SELECT 1 FROM "SalaryComponent" lain
    JOIN "UserSalaryComponent" u ON u."componentId" = lain."id"
    WHERE lain."name" = sc."name" AND lain."companyId" IS NULL AND lain."id" <> sc."id"
  );

-- 1. Komponen global (companyId NULL = berlaku semua PT), dibuat HANYA kalau
--    belum ada. Nama-nama ini yang dipakai `payrollService`/`loadEmployeeContext`
--    untuk mencocokkan balik.
INSERT INTO "SalaryComponent" ("id", "companyId", "name", "kind", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, NULL, v.nama, 'ALLOWANCE', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (VALUES ('Uang Makan'), ('Uang Transport'), ('Uang Jabatan'), ('BPJS Kesehatan')) AS v(nama)
WHERE NOT EXISTS (
  SELECT 1 FROM "SalaryComponent" sc WHERE sc."name" = v.nama AND sc."companyId" IS NULL
);

-- 2. Backfill nilai tiap karyawan yang > 0 ke UserSalaryComponent.
--    ON CONFLICT DO NOTHING: karyawan yang komponennya sudah disetel lewat
--    aplikasi mempertahankan nominalnya.
INSERT INTO "UserSalaryComponent" ("id", "userId", "componentId", "amount", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, u."id", sc."id", u."mealAllowance", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "user" u, "SalaryComponent" sc
WHERE sc."name" = 'Uang Makan' AND sc."companyId" IS NULL
  AND u."mealAllowance" IS NOT NULL AND u."mealAllowance" > 0
ON CONFLICT ("userId", "componentId") DO NOTHING;

INSERT INTO "UserSalaryComponent" ("id", "userId", "componentId", "amount", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, u."id", sc."id", u."transportAllowance", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "user" u, "SalaryComponent" sc
WHERE sc."name" = 'Uang Transport' AND sc."companyId" IS NULL
  AND u."transportAllowance" IS NOT NULL AND u."transportAllowance" > 0
ON CONFLICT ("userId", "componentId") DO NOTHING;

INSERT INTO "UserSalaryComponent" ("id", "userId", "componentId", "amount", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, u."id", sc."id", u."positionAllowance", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "user" u, "SalaryComponent" sc
WHERE sc."name" = 'Uang Jabatan' AND sc."companyId" IS NULL
  AND u."positionAllowance" IS NOT NULL AND u."positionAllowance" > 0
ON CONFLICT ("userId", "componentId") DO NOTHING;

INSERT INTO "UserSalaryComponent" ("id", "userId", "componentId", "amount", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, u."id", sc."id", u."bpjsKesehatan", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "user" u, "SalaryComponent" sc
WHERE sc."name" = 'BPJS Kesehatan' AND sc."companyId" IS NULL
  AND u."bpjsKesehatan" IS NOT NULL AND u."bpjsKesehatan" > 0
ON CONFLICT ("userId", "componentId") DO NOTHING;

-- 3. View yang membaca kolom lama dialihkan DULU.
--
--    `hv_employees` dan `hv_payroll_monthly` menyebut u."mealAllowance" dan
--    u."transportAllowance", dan Postgres menolak DROP COLUMN selama masih ada
--    yang bergantung padanya ("cannot drop column ... because other objects
--    depend on it"). Ini yang membuat versi pertama tetap gagal bahkan sesudah
--    tabrakan unique key diperbaiki.
--
--    Sumber nominalnya kini UserSalaryComponent, lewat satu fungsi supaya tidak
--    ada view yang menuliskan ulang cara mencarinya sendiri.
CREATE OR REPLACE FUNCTION hv_user_allowance(p_user_id text, p_name text)
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE((
    SELECT usc."amount"
    FROM "UserSalaryComponent" usc
    JOIN "SalaryComponent" sc ON sc."id" = usc."componentId"
    WHERE usc."userId" = p_user_id
      AND sc."name" = p_name
      AND sc."companyId" IS NULL
    LIMIT 1
  ), 0::numeric)
$$;

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
    u."employmentStatus"::text AS employment_status,
        CASE u."employmentStatus"
            WHEN 'PKWTT'::"EmploymentStatus" THEN 'Karyawan Tetap'::text
            WHEN 'PKWT'::"EmploymentStatus" THEN 'Kontrak (PKWT)'::text
            WHEN 'PROBATION'::"EmploymentStatus" THEN 'Masa Percobaan'::text
            ELSE 'Belum Berkontrak'::text
        END AS employment_status_label,
    u."contractStartDate"::date AS contract_start_date,
    u."contractEndDate"::date AS contract_end_date,
        CASE
            WHEN u."employmentStatus" = 'PKWTT'::"EmploymentStatus" THEN 1
            WHEN u."employmentStatus" = 'PKWT'::"EmploymentStatus" AND (u."contractEndDate" IS NULL OR u."contractEndDate"::date >= CURRENT_DATE) THEN 1
            ELSE 0
        END AS berkontrak,
    COALESCE(u."baseSalary", 0::numeric) AS base_salary,
    hv_user_allowance(u.id, 'Uang Makan') AS meal_allowance,
    hv_user_allowance(u.id, 'Uang Transport') AS transport_allowance,
    COALESCE(u."baseSalary", 0::numeric) + hv_user_allowance(u.id, 'Uang Makan') + hv_user_allowance(u.id, 'Uang Transport') AS total_fixed_salary,
    round((COALESCE(u."baseSalary", 0::numeric) + hv_user_allowance(u.id, 'Uang Makan') + hv_user_allowance(u.id, 'Uang Transport')) / 24::numeric, 0) AS daily_rate,
    u."branchId" AS branch_id,
    COALESCE(b.name, ''::text) AS branch_name,
    b."companyId" AS company_id,
    COALESCE(co.name, ''::text) AS company_name,
    COALESCE(co.code, ''::text) AS company_code,
    u."customRoleId" AS role_id,
    COALESCE(cr.name, 'Tanpa Role'::text) AS role_name,
    concat(u.name, ' — ', COALESCE(cr.name, 'Tanpa Role'::text), ' di ', COALESCE(co.name, 'PT tidak diketahui'::text), ' cabang ', COALESCE(b.name, 'tidak diketahui'::text), ' | Gaji pokok Rp ', to_char(COALESCE(u."baseSalary", 0::numeric), 'FM999,999,999'::text), ' | Total tetap Rp ', to_char(COALESCE(u."baseSalary", 0::numeric) + hv_user_allowance(u.id, 'Uang Makan') + hv_user_allowance(u.id, 'Uang Transport'), 'FM999,999,999'::text), ' | ',
        CASE u."employmentStatus"
            WHEN 'PKWTT'::"EmploymentStatus" THEN 'Karyawan Tetap'::text
            WHEN 'PKWT'::"EmploymentStatus" THEN 'Kontrak (PKWT)'::text
            WHEN 'PROBATION'::"EmploymentStatus" THEN 'Masa Percobaan'::text
            ELSE 'Belum Berkontrak'::text
        END,
        CASE
            WHEN u."isActive" THEN ' | Aktif'::text
            ELSE ' | Tidak Aktif'::text
        END) AS context_summary,
    u."createdAt" AS created_at
   FROM "user" u
     LEFT JOIN "Branch" b ON b.id = u."branchId"
     LEFT JOIN "Company" co ON co.id = b."companyId"
     LEFT JOIN custom_role cr ON cr.id = u."customRoleId";

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

-- 4. Kolom tetap sudah tidak dipakai lagi. `IF EXISTS` supaya migrasi ini tetap
--    bisa diulang kalau sempat berhenti di tengah.
ALTER TABLE "user" DROP COLUMN IF EXISTS "mealAllowance";
ALTER TABLE "user" DROP COLUMN IF EXISTS "transportAllowance";
ALTER TABLE "user" DROP COLUMN IF EXISTS "positionAllowance";
ALTER TABLE "user" DROP COLUMN IF EXISTS "bpjsKesehatan";
