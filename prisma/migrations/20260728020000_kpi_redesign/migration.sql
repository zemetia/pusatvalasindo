-- ═══════════════════════════════════════════════════════════════════════════
-- KPI REDESIGN
--
-- Mengganti model KPI lama (KpiDefinition.type EVENT|TARGET + KpiLog + Revenue)
-- dengan model yang mengikuti aturan pada sheet KPI perusahaan:
--   * 6 cara penilaian (target, penalti poin, reward poin, penalti persen,
--     batas toleransi, checklist harian) — bukan cuma 2
--   * kebijakan pengisian per-KPI: SELF / SUPERVISOR / SYSTEM + approval + bukti
--   * KpiEntry harian menggantikan KpiLog & Revenue, dan menempel ke RoleKpi
--     sehingga dua KPI target pada jabatan yang sama tidak lagi berbagi angka
--   * KpiPeriod untuk mengunci periode yang sudah dipakai payroll
--   * bonus/denda tidak lagi urusan modul KPI — konversinya menjadi uang
--     dipegang rule engine payroll (PayrollRule, migrasi 20260805000000)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Lepas view yang bergantung pada tabel/kolom lama ────────────────────
DROP VIEW IF EXISTS hv_payroll_monthly;
DROP VIEW IF EXISTS hv_kpi_definitions;
DROP VIEW IF EXISTS hv_kpi_logs;
DROP VIEW IF EXISTS hv_kpi_monthly;
DROP VIEW IF EXISTS hv_revenue;
DROP VIEW IF EXISTS hv_revenue_monthly;
DROP VIEW IF EXISTS hv_bonus_tiers;

-- ── 2. Enum baru ───────────────────────────────────────────────────────────
CREATE TYPE "KpiScoringType" AS ENUM (
  'TARGET_VALUE', 'PENALTY_POINT', 'REWARD_POINT',
  'PENALTY_PERCENT', 'TOLERANCE_LIMIT', 'BOOLEAN_DAILY'
);
CREATE TYPE "KpiUnit" AS ENUM ('OCCURRENCE', 'CURRENCY', 'POINT', 'PERCENT', 'DAY', 'PERSON');
CREATE TYPE "KpiDirection" AS ENUM ('HIGHER_BETTER', 'LOWER_BETTER');
CREATE TYPE "KpiInputSource" AS ENUM ('SELF', 'SUPERVISOR', 'SYSTEM');
CREATE TYPE "KpiEntryStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "KpiPeriodStatus" AS ENUM ('OPEN', 'LOCKED');
CREATE TYPE "KpiToleranceScope" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- ── 3. KpiDefinition: tipe lama → scoring type + kebijakan pengisian ───────
ALTER TABLE "KpiDefinition"
  ADD COLUMN "code"                    TEXT,
  ADD COLUMN "objective"               TEXT,
  ADD COLUMN "description"             TEXT,
  ADD COLUMN "scoringType"             "KpiScoringType",
  ADD COLUMN "unit"                    "KpiUnit"        NOT NULL DEFAULT 'OCCURRENCE',
  ADD COLUMN "direction"               "KpiDirection"   NOT NULL DEFAULT 'HIGHER_BETTER',
  ADD COLUMN "defaultInputSource"      "KpiInputSource" NOT NULL DEFAULT 'SUPERVISOR',
  ADD COLUMN "defaultRequiresApproval" BOOLEAN          NOT NULL DEFAULT true,
  ADD COLUMN "defaultRequiresEvidence" BOOLEAN          NOT NULL DEFAULT false,
  ADD COLUMN "systemSourceKey"         TEXT,
  ADD COLUMN "isActive"                BOOLEAN          NOT NULL DEFAULT true;

-- Slug dari nama; duplikat diberi akhiran angka agar tetap unik.
UPDATE "KpiDefinition" d
SET "code" = s.slug
FROM (
  SELECT id, CASE WHEN rn = 1 THEN base ELSE base || '-' || rn END AS slug
  FROM (
    SELECT id, base, ROW_NUMBER() OVER (PARTITION BY base ORDER BY "createdAt", id) AS rn
    FROM (
      SELECT id, "createdAt",
             NULLIF(TRIM(BOTH '-' FROM REGEXP_REPLACE(LOWER(name), '[^a-z0-9]+', '-', 'g')), '') AS base
      FROM "KpiDefinition"
    ) x
  ) y
) s
WHERE s.id = d.id;
UPDATE "KpiDefinition" SET "code" = 'kpi-' || id WHERE "code" IS NULL;

-- EVENT lama selalu berarti "kurangi poin per kejadian"; TARGET selalu nominal.
UPDATE "KpiDefinition"
SET "scoringType" = CASE WHEN "type" = 'TARGET' THEN 'TARGET_VALUE'::"KpiScoringType"
                         ELSE 'PENALTY_POINT'::"KpiScoringType" END,
    "unit"        = CASE WHEN "type" = 'TARGET' THEN 'CURRENCY'::"KpiUnit"
                         ELSE 'OCCURRENCE'::"KpiUnit" END;

ALTER TABLE "KpiDefinition"
  ALTER COLUMN "code" SET NOT NULL,
  ALTER COLUMN "scoringType" SET NOT NULL,
  DROP COLUMN "type";

CREATE UNIQUE INDEX "KpiDefinition_code_key" ON "KpiDefinition"("code");
CREATE INDEX "KpiDefinition_isActive_idx" ON "KpiDefinition"("isActive");

DROP TYPE "KpiType";

-- ── 4. RoleKpi: parameter penilaian menggantikan maxScore/threshold ───────
ALTER TABLE "RoleKpi"
  ADD COLUMN "basePoint"        DECIMAL(65,30) DEFAULT 100,
  ADD COLUMN "pointPerUnit"     DECIMAL(65,30),
  ADD COLUMN "toleranceLimit"   DECIMAL(65,30),
  ADD COLUMN "toleranceScope"   "KpiToleranceScope" DEFAULT 'DAILY',
  ADD COLUMN "maxAchievement"   DECIMAL(65,30) NOT NULL DEFAULT 1.2,
  ADD COLUMN "minAchievement"   DECIMAL(65,30) NOT NULL DEFAULT 0,
  ADD COLUMN "inputSource"      "KpiInputSource",
  ADD COLUMN "requiresApproval" BOOLEAN,
  ADD COLUMN "requiresEvidence" BOOLEAN,
  ADD COLUMN "isActive"         BOOLEAN NOT NULL DEFAULT true;

-- `threshold` lama = poin awal; nilai log lama sudah berupa poin, jadi 1 poin
-- per satuan. Angka ini perlu disetel ulang oleh admin sesuai catatan di sheet.
UPDATE "RoleKpi" SET "basePoint" = COALESCE("threshold", 100), "pointPerUnit" = 1;

ALTER TABLE "RoleKpi"
  DROP COLUMN "maxScore",
  DROP COLUMN "threshold";

-- ── 5. Tabel baru: KpiEntry & KpiPeriod ───────────────────────────────────
CREATE TABLE "KpiEntry" (
  "id"           TEXT NOT NULL,
  "employeeId"   TEXT NOT NULL,
  "roleKpiId"    TEXT NOT NULL,
  "occurredAt"   DATE NOT NULL,
  "periodYear"   INTEGER NOT NULL,
  "periodMonth"  INTEGER NOT NULL,
  "weekOfMonth"  INTEGER NOT NULL,
  "quantity"     DECIMAL(65,30) NOT NULL,
  "note"         TEXT,
  "evidenceUrl"  TEXT,
  "source"       "KpiInputSource" NOT NULL,
  "status"       "KpiEntryStatus" NOT NULL DEFAULT 'APPROVED',
  "createdById"  TEXT NOT NULL,
  "reviewedById" TEXT,
  "reviewedAt"   TIMESTAMP(3),
  "reviewNote"   TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "KpiEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "KpiEntry_employeeId_periodYear_periodMonth_idx" ON "KpiEntry"("employeeId", "periodYear", "periodMonth");
CREATE INDEX "KpiEntry_roleKpiId_periodYear_periodMonth_idx"  ON "KpiEntry"("roleKpiId", "periodYear", "periodMonth");
CREATE INDEX "KpiEntry_status_employeeId_idx"                 ON "KpiEntry"("status", "employeeId");
CREATE INDEX "KpiEntry_occurredAt_idx"                        ON "KpiEntry"("occurredAt");

ALTER TABLE "KpiEntry"
  ADD CONSTRAINT "KpiEntry_employeeId_fkey"   FOREIGN KEY ("employeeId")   REFERENCES "user"("id")    ON DELETE CASCADE  ON UPDATE CASCADE,
  ADD CONSTRAINT "KpiEntry_createdById_fkey"  FOREIGN KEY ("createdById")  REFERENCES "user"("id")    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "KpiEntry_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "user"("id")    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "KpiEntry_roleKpiId_fkey"    FOREIGN KEY ("roleKpiId")    REFERENCES "RoleKpi"("id") ON DELETE CASCADE  ON UPDATE CASCADE;

CREATE TABLE "KpiPeriod" (
  "id"         TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "month"      INTEGER NOT NULL,
  "year"       INTEGER NOT NULL,
  "status"     "KpiPeriodStatus" NOT NULL DEFAULT 'OPEN',
  "lockedAt"   TIMESTAMP(3),
  "lockedById" TEXT,
  "note"       TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "KpiPeriod_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KpiPeriod_employeeId_month_year_key" ON "KpiPeriod"("employeeId", "month", "year");
CREATE INDEX "KpiPeriod_year_month_status_idx"            ON "KpiPeriod"("year", "month", "status");

ALTER TABLE "KpiPeriod"
  ADD CONSTRAINT "KpiPeriod_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "user"("id") ON DELETE CASCADE  ON UPDATE CASCADE,
  ADD CONSTRAINT "KpiPeriod_lockedById_fkey" FOREIGN KEY ("lockedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 6. Pindahkan data KpiLog & Revenue ke KpiEntry ────────────────────────
-- Log yang jabatan/PT-nya tidak lagi punya konfigurasi RoleKpi ikut hilang:
-- baris seperti itu memang tidak pernah bisa dinilai oleh engine mana pun.
INSERT INTO "KpiEntry" (
  "id", "employeeId", "roleKpiId", "occurredAt", "periodYear", "periodMonth",
  "weekOfMonth", "quantity", "note", "source", "status", "createdById",
  "createdAt", "updatedAt"
)
SELECT
  kl.id,
  kl."employeeId",
  rk.id,
  kl."createdAt"::date,
  EXTRACT(YEAR  FROM kl."createdAt")::int,
  EXTRACT(MONTH FROM kl."createdAt")::int,
  FLOOR((EXTRACT(DAY FROM kl."createdAt")::int - 1) / 7) + 1,
  kl.value,
  kl.note,
  'SUPERVISOR'::"KpiInputSource",
  'APPROVED'::"KpiEntryStatus",
  kl."employeeId",
  kl."createdAt",
  kl."createdAt"
FROM "KpiLog" kl
JOIN "user" u        ON u.id = kl."employeeId"
LEFT JOIN "Branch" b ON b.id = u."branchId"
JOIN "RoleKpi" rk    ON rk."kpiId" = kl."kpiId"
                    AND rk."customRoleId" IS NOT DISTINCT FROM u."customRoleId"
                    AND rk."companyId" = b."companyId";

-- Revenue lama tidak menyebut KPI mana pun (engine lama memakainya untuk SEMUA
-- KPI target sekaligus — sumber bug yang diperbaiki di sini). Saat migrasi tiap
-- baris ditempelkan ke satu KPI target berbobot terbesar milik jabatan tersebut.
INSERT INTO "KpiEntry" (
  "id", "employeeId", "roleKpiId", "occurredAt", "periodYear", "periodMonth",
  "weekOfMonth", "quantity", "note", "source", "status", "createdById",
  "createdAt", "updatedAt"
)
SELECT
  r.id,
  r."employeeId",
  t.role_kpi_id,
  r.date,
  EXTRACT(YEAR  FROM r.date)::int,
  EXTRACT(MONTH FROM r.date)::int,
  FLOOR((EXTRACT(DAY FROM r.date)::int - 1) / 7) + 1,
  r.amount,
  r.note,
  'SUPERVISOR'::"KpiInputSource",
  'APPROVED'::"KpiEntryStatus",
  r."employeeId",
  r."createdAt",
  r."createdAt"
FROM "Revenue" r
JOIN (
  SELECT DISTINCT ON (u.id) u.id AS user_id, rk.id AS role_kpi_id
  FROM "user" u
  LEFT JOIN "Branch" b     ON b.id = u."branchId"
  JOIN "RoleKpi" rk        ON rk."customRoleId" IS NOT DISTINCT FROM u."customRoleId"
                          AND rk."companyId" = b."companyId"
  JOIN "KpiDefinition" kd  ON kd.id = rk."kpiId"
  WHERE kd."scoringType" = 'TARGET_VALUE'
  ORDER BY u.id, rk.weight DESC, rk.id
) t ON t.user_id = r."employeeId";

-- ── 7. KpiMonthlyResult: simpan grade, lepas bonus ────────────────────────
ALTER TABLE "KpiMonthlyResult"
  ADD COLUMN "grade" TEXT NOT NULL DEFAULT 'D',
  DROP COLUMN "bonusAmount",
  DROP COLUMN "bonusResult";

-- Seluruh skor tersimpan dihitung dengan bug bobot-kuadrat (skor dikalikan
-- bobot dua kali), jadi angkanya tidak sah. Dihapus agar dihitung ulang.
DELETE FROM "KpiMonthlyResult";

-- ── 8. Buang tabel lama ───────────────────────────────────────────────────
DROP TABLE "KpiLog";
DROP TABLE "Revenue";

-- ── 9. Buang matriks bonus lama ───────────────────────────────────────────
-- BonusMatrix/BonusTier tidak dipindahkan ke mana pun. Penggantinya adalah
-- rule engine (PayrollRule, migrasi 20260805000000), dan tier-nya ditulis
-- ulang dari nol lewat prisma/seeds/payroll-rules/ — bukan hasil konversi.
-- Riwayat ini sengaja dirapikan: matriks insentif perantara
-- (PayrollIncentiveMatrix/Tier) pernah ada di sini, lalu dibuang seluruhnya
-- sebelum dipakai produksi, jadi membiarkannya di migrasi hanya membuat
-- database baru membangun tabel yang langsung dihancurkan lagi.
DROP TABLE "BonusTier";
DROP TABLE "BonusMatrix";
DROP TYPE "BonusResultType";

-- ── 10. Bangun ulang view hv_* ────────────────────────────────────────────
-- Nama view dipertahankan supaya tool MCP di src/backend/mcp/read-tools.ts
-- tidak perlu ikut berubah; isinya kini bersumber dari tabel baru.

CREATE OR REPLACE VIEW hv_kpi_definitions AS
SELECT
  rk.id,
  kd.id                                     AS kpi_id,
  kd.code                                   AS kpi_code,
  kd.name                                   AS kpi_name,
  COALESCE(kd.objective, '')                AS objective,
  COALESCE(kd.description, '')              AS description,
  kd."scoringType"                          AS scoring_type,
  CASE kd."scoringType"
    WHEN 'TARGET_VALUE'    THEN 'Target Nilai'
    WHEN 'PENALTY_POINT'   THEN 'Penalti Poin per Kejadian'
    WHEN 'REWARD_POINT'    THEN 'Reward Poin per Kejadian'
    WHEN 'PENALTY_PERCENT' THEN 'Penalti Persen per Kejadian'
    WHEN 'TOLERANCE_LIMIT' THEN 'Batas Toleransi'
    WHEN 'BOOLEAN_DAILY'   THEN 'Checklist Harian'
    ELSE kd."scoringType"::text
  END                                       AS scoring_type_label,
  kd.unit                                   AS unit,
  COALESCE(rk."inputSource", kd."defaultInputSource")           AS input_source,
  CASE COALESCE(rk."inputSource", kd."defaultInputSource")
    WHEN 'SELF'       THEN 'Diisi karyawan sendiri'
    WHEN 'SUPERVISOR' THEN 'Hanya atasan/HR'
    WHEN 'SYSTEM'     THEN 'Otomatis dari sistem'
  END                                       AS input_source_label,
  COALESCE(rk."requiresApproval", kd."defaultRequiresApproval") AS requires_approval,
  COALESCE(rk."requiresEvidence", kd."defaultRequiresEvidence") AS requires_evidence,
  rk."companyId"                            AS company_id,
  COALESCE(co.name, '')                     AS company_name,
  COALESCE(co.code, '')                     AS company_code,
  rk."customRoleId"                         AS role_id,
  COALESCE(cr.name, '')                     AS role_name,
  rk.weight::numeric                        AS weight,
  ROUND(
    rk.weight::numeric
    / NULLIF(SUM(rk.weight::numeric) OVER (PARTITION BY rk."companyId", rk."customRoleId"), 0)
    * 100, 2
  )                                         AS weight_pct,
  rk."targetValue"::numeric                 AS target_value,
  rk."basePoint"::numeric                   AS base_point,
  rk."pointPerUnit"::numeric                AS point_per_unit,
  rk."toleranceLimit"::numeric              AS tolerance_limit,
  rk."maxAchievement"::numeric              AS max_achievement,
  rk."isActive"                             AS is_active,
  kd."createdAt"                            AS created_at
FROM "RoleKpi" rk
JOIN "KpiDefinition" kd  ON kd.id = rk."kpiId"
LEFT JOIN "Company" co   ON co.id = rk."companyId"
LEFT JOIN "custom_role" cr ON cr.id = rk."customRoleId";

CREATE OR REPLACE VIEW hv_kpi_logs AS
SELECT
  ke.id,
  ke."employeeId"                           AS employee_id,
  u.name                                    AS employee_name,
  b."companyId"                             AS company_id,
  COALESCE(co.name, '')                     AS company_name,
  COALESCE(co.code, '')                     AS company_code,
  COALESCE(b.name, '')                      AS branch_name,
  COALESCE(cr.name, '')                     AS role_name,
  kd.id                                     AS kpi_id,
  kd.name                                   AS kpi_name,
  kd."scoringType"                          AS scoring_type,
  kd.unit                                   AS unit,
  ke.quantity::numeric                      AS value,
  ke.quantity::numeric                      AS quantity,
  COALESCE(ke.note, '')                     AS note,
  ke.source                                 AS input_source,
  ke.status                                 AS status,
  CASE ke.status
    WHEN 'PENDING'  THEN 'Menunggu Persetujuan'
    WHEN 'APPROVED' THEN 'Disetujui'
    WHEN 'REJECTED' THEN 'Ditolak'
  END                                       AS status_label,
  ke."occurredAt"                           AS occurred_at,
  ke."weekOfMonth"                          AS week_of_month,
  ke."createdAt"                            AS created_at,
  ke."periodYear"                           AS year,
  ke."periodMonth"                          AS month,
  TO_CHAR(MAKE_DATE(ke."periodYear", ke."periodMonth", 1), 'YYYY-MM') AS period_label
FROM "KpiEntry" ke
JOIN "user" u            ON u.id = ke."employeeId"
JOIN "RoleKpi" rk        ON rk.id = ke."roleKpiId"
JOIN "KpiDefinition" kd  ON kd.id = rk."kpiId"
LEFT JOIN "Branch" b     ON b.id = u."branchId"
LEFT JOIN "Company" co   ON co.id = b."companyId"
LEFT JOIN "custom_role" cr ON cr.id = u."customRoleId";

CREATE OR REPLACE VIEW hv_kpi_monthly AS
SELECT
  km.id,
  km."employeeId"                           AS employee_id,
  u.name                                    AS employee_name,
  b."companyId"                             AS company_id,
  COALESCE(co.name, '')                     AS company_name,
  COALESCE(co.code, '')                     AS company_code,
  u."branchId"                              AS branch_id,
  COALESCE(b.name, '')                      AS branch_name,
  COALESCE(cr.name, '')                     AS role_name,
  km.month,
  km.year,
  TO_CHAR(MAKE_DATE(km.year, km.month, 1), 'YYYY-MM') AS period_label,
  km."totalScore"::numeric                  AS total_score,
  ROUND(km."totalScore"::numeric * 100, 2)  AS total_score_pct,
  km.grade                                  AS grade,
  CASE km.grade
    WHEN 'A' THEN 'Sangat Baik'
    WHEN 'B' THEN 'Baik'
    WHEN 'C' THEN 'Cukup'
    ELSE 'Perlu Peningkatan'
  END                                       AS grade_label,
  kp.status                                 AS period_status,
  km."breakdownJson"                        AS breakdown_json,
  km."calculatedAt"                         AS calculated_at,
  CONCAT(
    u.name, ' (', COALESCE(cr.name, '-'), ')',
    ' | KPI ', TO_CHAR(MAKE_DATE(km.year, km.month, 1), 'Mon YYYY'),
    ' | Skor: ', ROUND(km."totalScore"::numeric * 100, 1), '%',
    ' | Grade: ', km.grade
  )                                         AS context_summary
FROM "KpiMonthlyResult" km
JOIN "user" u            ON u.id = km."employeeId"
LEFT JOIN "KpiPeriod" kp ON kp."employeeId" = km."employeeId" AND kp.month = km.month AND kp.year = km.year
LEFT JOIN "Branch" b     ON b.id = u."branchId"
LEFT JOIN "Company" co   ON co.id = b."companyId"
LEFT JOIN "custom_role" cr ON cr.id = u."customRoleId";

-- Omzet kini hanyalah entri KPI ber-unit CURRENCY; view revenue lama tetap
-- tersedia agar tool get_revenue_monthly tidak berubah.
CREATE OR REPLACE VIEW hv_revenue AS
SELECT
  ke.id,
  ke."employeeId"                           AS employee_id,
  u.name                                    AS employee_name,
  b."companyId"                             AS company_id,
  COALESCE(co.name, '')                     AS company_name,
  COALESCE(co.code, '')                     AS company_code,
  u."branchId"                              AS branch_id,
  COALESCE(b.name, '')                      AS branch_name,
  COALESCE(cr.name, '')                     AS role_name,
  kd.name                                   AS kpi_name,
  ke.quantity::numeric                      AS amount,
  ke."occurredAt"                           AS date,
  ke."periodYear"                           AS year,
  ke."periodMonth"                          AS month,
  TO_CHAR(MAKE_DATE(ke."periodYear", ke."periodMonth", 1), 'YYYY-MM') AS period_label,
  COALESCE(ke.note, '')                     AS note,
  ke."createdAt"                            AS created_at
FROM "KpiEntry" ke
JOIN "RoleKpi" rk        ON rk.id = ke."roleKpiId"
JOIN "KpiDefinition" kd  ON kd.id = rk."kpiId" AND kd.unit = 'CURRENCY'
JOIN "user" u            ON u.id = ke."employeeId"
LEFT JOIN "Branch" b     ON b.id = u."branchId"
LEFT JOIN "Company" co   ON co.id = b."companyId"
LEFT JOIN "custom_role" cr ON cr.id = u."customRoleId"
WHERE ke.status = 'APPROVED';

CREATE OR REPLACE VIEW hv_revenue_monthly AS
SELECT
  ke."employeeId"                           AS employee_id,
  u.name                                    AS employee_name,
  b."companyId"                             AS company_id,
  COALESCE(co.name, '')                     AS company_name,
  COALESCE(co.code, '')                     AS company_code,
  u."branchId"                              AS branch_id,
  COALESCE(b.name, '')                      AS branch_name,
  COALESCE(cr.name, '')                     AS role_name,
  ke."periodYear"                           AS year,
  ke."periodMonth"                          AS month,
  TO_CHAR(MAKE_DATE(ke."periodYear", ke."periodMonth", 1), 'YYYY-MM') AS period_label,
  COUNT(*)                                  AS transaction_count,
  SUM(ke.quantity)::numeric                 AS total_revenue,
  ROUND(AVG(ke.quantity)::numeric, 0)       AS avg_revenue_per_entry,
  MAX(ke.quantity)::numeric                 AS max_single_entry,
  MIN(ke.quantity)::numeric                 AS min_single_entry
FROM "KpiEntry" ke
JOIN "RoleKpi" rk        ON rk.id = ke."roleKpiId"
JOIN "KpiDefinition" kd  ON kd.id = rk."kpiId" AND kd.unit = 'CURRENCY'
JOIN "user" u            ON u.id = ke."employeeId"
LEFT JOIN "Branch" b     ON b.id = u."branchId"
LEFT JOIN "Company" co   ON co.id = b."companyId"
LEFT JOIN "custom_role" cr ON cr.id = u."customRoleId"
WHERE ke.status = 'APPROVED'
GROUP BY ke."employeeId", u.name, u."branchId", b."companyId", co.name, co.code,
         b.name, cr.name, ke."periodYear", ke."periodMonth";

-- Estimasi payroll: skor & grade KPI ikut ditampilkan, tapi nominal bonus tidak
-- ada di sini — konversi skor → uang dilakukan rule engine (PayrollRule,
-- migrasi 20260805000000), yang butuh peringkat antar-karyawan sehingga tidak
-- bisa diringkas per baris view.
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

-- ── 11. Kembalikan hak baca untuk reader read-only ────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'oc_pvi_reader') THEN
    GRANT SELECT ON hv_kpi_definitions TO oc_pvi_reader;
    GRANT SELECT ON hv_kpi_logs        TO oc_pvi_reader;
    GRANT SELECT ON hv_kpi_monthly     TO oc_pvi_reader;
    GRANT SELECT ON hv_revenue         TO oc_pvi_reader;
    GRANT SELECT ON hv_revenue_monthly TO oc_pvi_reader;
    GRANT SELECT ON hv_payroll_monthly TO oc_pvi_reader;
  END IF;
END $$;
