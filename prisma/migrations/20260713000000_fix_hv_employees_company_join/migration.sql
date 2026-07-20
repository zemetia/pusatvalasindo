-- Fix hv_employees: fall back to branch's companyId when employee.companyId
-- is null, so employees without a directly-assigned company still show up
-- with the correct company context instead of being excluded/blank.

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
