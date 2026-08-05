-- ═══════════════════════════════════════════════════════════════════════════
-- hv_kpi_logs: tambah `kpi_code`, `branch_id`, dan `role_id`.
--
-- Ketiganya dibutuhkan rule gaji yang menilai satu tim — semua karyawan
-- berjabatan sama di cabang yang sama — dan tidak satu pun bisa digantikan
-- kolom yang sudah ada:
--
-- • `kpi_code`  — sebelumnya view hanya membawa `kpi_name`. Menyaring omzet
--   dengan `kpi_name = 'Jumlah Omzet'` berarti mengganti nama KPI di halaman
--   admin diam-diam mematikan rule gaji: query tetap jalan, hasilnya nol, tidak
--   ada error di mana pun. `code` justru dijamin stabil dan unik
--   (KpiDefinition.code @unique), jadi itu yang layak jadi pegangan uang.
--
-- • `branch_id` / `role_id` — view hanya membawa `branch_name` dan `role_name`.
--   Engine menyuntikkan `:branch_id` dan `:custom_role_id` sebagai ID, jadi
--   tanpa kolom ini rule harus mencocokkan lewat nama. Nama cabang boleh
--   berubah dan nama jabatan berulang di beberapa PT ("Marketing" ada di PVI,
--   PTU, dan PKD) — mencocokkan lewat nama akan menggabungkan tim yang bukan
--   satu tim.
--
-- Kolom lama TIDAK dihapus; ini penambahan murni, jadi pemakai view yang sudah
-- ada tidak terpengaruh.
--
-- CATATAN, bukan bagian migrasi ini: `hv_revenue_monthly.total_revenue` adalah
-- SUM seluruh KpiEntry ber-unit CURRENCY, sehingga ia mencampur "Jumlah Omzet",
-- "Net Profit Margin", dan "Kesesuaian Jumlah Kas" — yang terakhir itu SELISIH
-- KAS, bukan omzet. View itu cukup untuk ringkasan dashboard, tapi TIDAK boleh
-- dipakai menghitung uang. Rule omzet memakai hv_kpi_logs + kpi_code.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW hv_kpi_logs AS
SELECT
  ke.id,
  ke."employeeId"                           AS employee_id,
  u.name                                    AS employee_name,
  b."companyId"                             AS company_id,
  COALESCE(co.name, '')                     AS company_name,
  COALESCE(co.code, '')                     AS company_code,
  u."branchId"                              AS branch_id,
  COALESCE(b.name, '')                      AS branch_name,
  u."customRoleId"                          AS role_id,
  COALESCE(cr.name, '')                     AS role_name,
  kd.id                                     AS kpi_id,
  kd.code                                   AS kpi_code,
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

-- Peran read-only rule engine. Dibungkus DO supaya migrasi tetap jalan di
-- lingkungan yang belum membuat peran itu (mis. database pengembangan lokal).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'oc_pvi_reader') THEN
    GRANT SELECT ON hv_kpi_logs TO oc_pvi_reader;
  END IF;
END $$;
