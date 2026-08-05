-- ═══════════════════════════════════════════════════════════════════════════
-- Tiga hal sekaligus, karena saling bergantung:
--
--   1. Status kontrak karyawan — supaya aturan "yang masih belum di kontrak
--      belum bisa mendapatkan bonus tambahan" punya data untuk dicek.
--   2. Larangan masa berlaku rule yang beririsan — ditegakkan database, bukan
--      hanya aplikasi.
--   3. Sanksi non-uang (wajib masuk Sabtu, SP) pada tier rule engine, plus
--      hv_bonus_tiers yang dibangun ulang di atas rule engine.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Status ikatan kerja ──────────────────────────────────────────────────
CREATE TYPE "EmploymentStatus" AS ENUM ('BELUM_KONTRAK', 'PROBATION', 'PKWT', 'PKWTT');

-- Default BELUM_KONTRAK dipilih dengan sadar. Menebak "sudah berkontrak"
-- berarti membayar bonus kepada orang yang belum berhak, dan uang yang sudah
-- keluar tidak bisa ditarik kembali; menebak sebaliknya hanya menahan bonus
-- sampai HR mengisi datanya.
ALTER TABLE "user"
  ADD COLUMN "employmentStatus" "EmploymentStatus" NOT NULL DEFAULT 'BELUM_KONTRAK',
  ADD COLUMN "contractStartDate" TIMESTAMP(3),
  ADD COLUMN "contractEndDate"   TIMESTAMP(3);

CREATE INDEX "user_employmentStatus_idx" ON "user"("employmentStatus");

-- ── 2. Sanksi non-uang pada tier rule ───────────────────────────────────────
ALTER TABLE "PayrollRuleTier"
  ADD COLUMN "mandatorySaturday" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "warningLetter"     BOOLEAN NOT NULL DEFAULT false;

-- Tanda tangan rule mencakup seluruh isi tier. Dua kolom baru mengubah bentuk
-- kanoniknya, sehingga SELURUH rule yang sudah ada gagal verifikasi sampai
-- ditandatangani ulang. Itu memang perilaku yang benar — tapi harus disengaja,
-- bukan mengejutkan. Jalankan ulang seed (untuk database yang isinya masih
-- benih) atau simpan ulang tiap rule lewat halaman Rule.
--
-- Baris di bawah menandai keadaannya supaya jelas di halaman Rule, bukan
-- muncul sebagai "tanda tangan tidak cocok" tanpa sebab.
UPDATE "PayrollRule"
SET "changeNote" = COALESCE("changeNote", '') ||
  ' [Perlu ditandatangani ulang: kolom sanksi non-uang ditambahkan pada tier, ' ||
  'migrasi 20260805020000.]'
WHERE TRUE;

-- ── 3. Larangan masa berlaku beririsan ──────────────────────────────────────
--
-- `@@unique([ruleKey, version])` hanya mencegah nomor versi ganda — dua versi
-- BERBEDA yang rentang tanggalnya bertabrakan tetap lolos. Pemeriksaan
-- aplikasi (`crossVersionChecks`) menangkapnya saat rule dimuat, tapi itu
-- terlambat: barisnya sudah tersimpan, dan dua permintaan yang berjalan
-- bersamaan bisa sama-sama lolos pemeriksaan sebelum keduanya menulis.
--
-- EXCLUDE dengan gist adalah satu-satunya cara Postgres menegakkan "tidak ada
-- dua baris dengan ruleKey sama yang rentang tanggalnya beririsan". btree_gist
-- dibutuhkan supaya kolom teks (`ruleKey`) bisa ikut di dalam indeks gist.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Rentang ditulis '[]' — INKLUSIF di kedua ujung — supaya cocok dengan cara
-- loader memilih rule (`berlaku_sampai >= tanggal`). Kalau ditulis '[)',
-- constraint akan mengizinkan versi baru mulai di hari yang sama dengan hari
-- terakhir versi lama, dan hari itu akan punya dua rule yang berlaku.
--
-- effectiveTo NULL berarti belum berakhir → 'infinity'.
ALTER TABLE "PayrollRule"
  ADD CONSTRAINT "payroll_rule_no_overlap"
  EXCLUDE USING gist (
    "ruleKey" WITH =,
    daterange(
      "effectiveFrom"::date,
      COALESCE("effectiveTo"::date, 'infinity'::date),
      '[]'
    ) WITH &&
  );

-- ── 4. hv_bonus_tiers di atas rule engine ───────────────────────────────────
--
-- View ini dipakai MCP tool `get_bonus_tiers`; sejak matriks insentif lama
-- tidak lagi ada, sumbernya adalah PayrollRule + PayrollRuleTier. Nama kolom
-- kunci (company_id, company_code, role_name, min_score) dipertahankan supaya
-- definisi tool tidak perlu diubah.
--
-- Satu rule bisa menyasar banyak PT dan banyak jabatan sekaligus lewat
-- `targets`, jadi barisnya dikembangkan: satu baris per (rule, tier, PT,
-- jabatan). `"*"` berarti seluruh PT / seluruh jabatan di PT itu.
--
-- DROP dulu, bukan CREATE OR REPLACE saja: bentuk kolomnya berbeda dari versi
-- view sebelumnya, dan CREATE OR REPLACE menolak perubahan susunan kolom.
DROP VIEW IF EXISTS hv_bonus_tiers;

CREATE OR REPLACE VIEW hv_bonus_tiers AS
WITH grup AS (
  SELECT r.id            AS rule_id,
         r."ruleKey"     AS rule_key,
         r.version       AS rule_version,
         r.type          AS rule_type,
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
  s.rule_type::text                         AS result_type,
  CASE s.rule_type
    WHEN 'BONUS'    THEN 'Bonus'
    WHEN 'DENDA'    THEN 'Denda'
    WHEN 'POTONGAN' THEN 'Potongan'
    ELSE s.rule_type::text
  END                                       AS result_label,
  COALESCE(t.nominal, 0)::numeric           AS cash_amount,
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
    ' → Rp ', to_char(COALESCE(t.nominal, 0), 'FM999,999,999'),
    ' | ', t.label
  )                                         AS context_summary
FROM sasaran s
JOIN "PayrollRuleTier" t ON t."ruleId" = s.rule_id;

-- ── 5. hv_employees: buka status kontrak untuk rule ─────────────────────────
--
-- Rule hanya boleh membaca view `hv_*`, jadi tanpa kolom ini gate kontrak
-- tidak bisa ditulis sebagai rule sama sekali.
--
-- `berkontrak` sengaja berupa 0/1 yang sudah jadi, bukan tanggal mentah:
-- perbandingan tanggal di dalam rule mudah ditulis salah, dan aturannya sama
-- untuk semua PT. PKWT yang tanggal habisnya sudah lewat dihitung TIDAK
-- berkontrak.
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
            WHEN 'PKWTT' THEN 'Karyawan Tetap'::text
            WHEN 'PKWT' THEN 'Kontrak (PKWT)'::text
            WHEN 'PROBATION' THEN 'Masa Percobaan'::text
            ELSE 'Belum Berkontrak'::text
        END AS employment_status_label,
    u."contractStartDate"::date AS contract_start_date,
    u."contractEndDate"::date AS contract_end_date,
        CASE
            WHEN u."employmentStatus" = 'PKWTT' THEN 1
            WHEN u."employmentStatus" = 'PKWT'
             AND (u."contractEndDate" IS NULL OR u."contractEndDate"::date >= CURRENT_DATE) THEN 1
            ELSE 0
        END AS berkontrak,
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
    concat(u.name, ' — ', COALESCE(cr.name, 'Tanpa Role'::text), ' di ', COALESCE(co.name, 'PT tidak diketahui'::text), ' cabang ', COALESCE(b.name, 'tidak diketahui'::text), ' | Gaji pokok Rp ', to_char(COALESCE(u."baseSalary", 0::numeric), 'FM999,999,999'::text), ' | Total tetap Rp ', to_char(COALESCE(u."baseSalary", 0::numeric) + COALESCE(u."mealAllowance", 0::numeric) + COALESCE(u."transportAllowance", 0::numeric), 'FM999,999,999'::text), ' | ',
        CASE u."employmentStatus"
            WHEN 'PKWTT' THEN 'Karyawan Tetap'::text
            WHEN 'PKWT' THEN 'Kontrak (PKWT)'::text
            WHEN 'PROBATION' THEN 'Masa Percobaan'::text
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

-- Dijaga IF EXISTS supaya migration tetap jalan di database yang belum pernah
-- disiapkan lewat `tsx sql/apply_openclaw.ts`.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'oc_pvi_reader') THEN
    GRANT SELECT ON hv_employees TO oc_pvi_reader;
    GRANT SELECT ON hv_bonus_tiers TO oc_pvi_reader;
  END IF;
END $$;
