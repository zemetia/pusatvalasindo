-- ═══════════════════════════════════════════════════════════════════════════
-- Arah uang pindah dari RULE ke KONDISI.
--
-- Sebelumnya `PayrollRule.type` menentukan arah seluruh rule: tipe BONUS selalu
-- menambah, DENDA/POTONGAN selalu mengurangi. Akibatnya satu jabatan butuh
-- SEPASANG rule — `bonus_kpi_pvi_teller_dalam` dan `denda_kpi_pvi_teller_dalam`
-- — yang menyalin SQL, guard, dan sasaran yang sama persis, padahal sheet
-- manajemen menuliskannya sebagai SATU tabel: skor rendah dipotong, skor tinggi
-- dibonus. Dua baris yang harus diubah bersamaan setiap satu band bergeser, dan
-- tidak ada yang menjamin keduanya tetap sinkron.
--
-- Sesudah migrasi ini arah dibaca dari TANDA nominal tiap tier/guard: positif
-- menambah, negatif mengurangi. Rule tidak punya tipe lagi.
--
-- AMAN DIJALANKAN karena tabel hasil payroll sudah dikosongkan pada migrasi
-- 20260805030000 dan rule di-seed ulang: tidak ada slip yang merujuk arah lama.
-- Kalau tabel ini ternyata berisi rule buatan HR, angkanya WAJIB ditinjau —
-- lihat blok terakhir.
-- ═══════════════════════════════════════════════════════════════════════════

-- Nominal tier yang berasal dari rule bertipe DENDA/POTONGAN dulunya disimpan
-- POSITIF dan dibalik tandanya oleh engine. Sekarang tandanya harus ada di
-- datanya sendiri, jadi dibalik di sini — sekali, untuk baris yang sudah ada.
UPDATE "PayrollRuleTier" t
SET
  "nominal" = CASE WHEN t."nominal" IS NULL THEN NULL ELSE -ABS(t."nominal") END,
  "perUnit" = CASE WHEN t."perUnit" IS NULL THEN NULL ELSE -ABS(t."perUnit") END
FROM "PayrollRule" r
WHERE r."id" = t."ruleId"
  AND r."type" IN ('DENDA', 'POTONGAN');

-- Tanda tangan seluruh rule ikut batal: `type` termasuk yang ditandatangani,
-- dan payload kanoniknya naik ke v2. Dikosongkan supaya baris lama DITOLAK
-- engine dengan pesan yang jelas ("tanda tangan tidak cocok") alih-alih diam-
-- diam ikut menghitung gaji dengan nominal yang baru saja dibalik tandanya.
UPDATE "PayrollRule" SET "signature" = '';

-- hv_bonus_tiers (dibangun migrasi 20260805020000) MEMBACA `r.type`. Selama
-- view itu masih ada, Postgres MENOLAK `DROP COLUMN` — bukan memperingatkan,
-- tapi menggagalkan seluruh migrasi. Dijatuhkan dulu di sini, dibangun ulang
-- di bawah tanpa kolom tipe.
DROP VIEW IF EXISTS hv_bonus_tiers;

ALTER TABLE "PayrollRule" DROP COLUMN "type";

DROP TYPE "PayrollRuleType";

-- ── hv_bonus_tiers tanpa `type` ─────────────────────────────────────────────
--
-- Arah uang sekarang dibaca dari TANDA nominal tiap tier, sama seperti engine
-- (`entryTypeOf`: negatif → denda, selain itu → bonus). Nama kolomnya
-- (`result_type`, `result_label`) dipertahankan supaya MCP tool
-- `get_bonus_tiers` tidak perlu diubah — yang berubah hanya asal nilainya.
--
-- Tier bernominal 0 sengaja diberi label sendiri ("Safe Zone") alih-alih ikut
-- dihitung bonus: band aman adalah kategori nyata di sheet manajemen, dan
-- menampilkannya sebagai "Bonus Rp 0" menyesatkan pembacanya.
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
      WHEN t.formula IS NOT NULL THEN 'formula ' || t.formula
      WHEN t."perUnit" IS NOT NULL THEN 'Rp ' || to_char(t."perUnit", 'FM999,999,999') || ' per ' || COALESCE(t."unitField", 'unit')
      ELSE 'Rp ' || to_char(COALESCE(t.nominal, 0), 'FM999,999,999')
    END,
    ' | ', t.label
  )                                         AS context_summary
FROM sasaran s
JOIN "PayrollRuleTier" t ON t."ruleId" = s.rule_id;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'oc_pvi_reader') THEN
    GRANT SELECT ON hv_bonus_tiers TO oc_pvi_reader;
  END IF;
END $$;
