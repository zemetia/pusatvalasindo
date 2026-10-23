-- Batasi KpiDefinition.description ke VARCHAR(10000).
-- hv_kpi_definitions membaca kolom ini, jadi view dibuang dulu lalu dibangun
-- ulang (definisi sama dengan 20260804000000_kpi_no_achievement_bounds).
DROP VIEW IF EXISTS hv_kpi_definitions;

ALTER TABLE "KpiDefinition" ALTER COLUMN "description" SET DATA TYPE VARCHAR(10000);

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
  rk."isActive"                             AS is_active,
  kd."createdAt"                            AS created_at
FROM "RoleKpi" rk
JOIN "KpiDefinition" kd  ON kd.id = rk."kpiId"
LEFT JOIN "Company" co   ON co.id = rk."companyId"
LEFT JOIN "custom_role" cr ON cr.id = rk."customRoleId";

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'oc_pvi_reader') THEN
    GRANT SELECT ON hv_kpi_definitions TO oc_pvi_reader;
  END IF;
END $$;
