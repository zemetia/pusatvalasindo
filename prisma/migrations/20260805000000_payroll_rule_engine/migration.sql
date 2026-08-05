-- Rule engine slip gaji: definisi rule (append-only, bertanda tangan) dan hasil
-- eksekusinya (run → slip → entri).
--
-- Spesifikasi: docs/tasks/spesifikasi-rule-slip-gaji.md
-- Schema:      prisma/schema/payroll-rule.prisma, prisma/schema/payroll-run.prisma

-- ── Enum ────────────────────────────────────────────────────────────────────

CREATE TYPE "PayrollRuleType"     AS ENUM ('BONUS', 'DENDA', 'POTONGAN');
CREATE TYPE "PayrollRuleMode"     AS ENUM ('AGREGAT', 'PER_BARIS');
CREATE TYPE "PayrollRunStatus"    AS ENUM ('DRAFT', 'FINALIZED', 'PAID', 'VOID');
CREATE TYPE "PayrollEntrySource"  AS ENUM ('RULE', 'COMPONENT', 'MANUAL');
CREATE TYPE "PayrollEntryType"    AS ENUM ('BONUS', 'DENDA', 'POTONGAN', 'TUNJANGAN');
CREATE TYPE "PayrollEntryStatus"  AS ENUM ('APPLIED', 'SKIPPED', 'ERROR');

-- ── Definisi rule ───────────────────────────────────────────────────────────
-- Baris TIDAK pernah di-UPDATE. Perubahan rule = baris baru dengan version naik
-- dan effectiveTo terisi di versi lama; supersedesId merantai keduanya.

CREATE TABLE "PayrollRule" (
    "id"            TEXT NOT NULL,
    "ruleKey"       TEXT NOT NULL,
    "version"       INTEGER NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo"   DATE,
    "type"          "PayrollRuleType" NOT NULL,
    "mode"          "PayrollRuleMode" NOT NULL,
    "sql"           TEXT NOT NULL,
    "tierField"     TEXT NOT NULL,
    "constants"     JSONB,
    "guards"        JSONB,
    "defaults"      JSONB NOT NULL,
    "targets"       JSONB NOT NULL,
    "excepts"       JSONB,
    "note"          TEXT,
    "changeNote"    TEXT,
    "signature"     TEXT NOT NULL,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById"   TEXT,
    "supersedesId"  TEXT,

    CONSTRAINT "PayrollRule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PayrollRule_supersedesId_key"     ON "PayrollRule"("supersedesId");
CREATE UNIQUE INDEX "PayrollRule_ruleKey_version_key"  ON "PayrollRule"("ruleKey", "version");
CREATE INDEX "PayrollRule_ruleKey_idx"                 ON "PayrollRule"("ruleKey");
CREATE INDEX "PayrollRule_effectiveFrom_effectiveTo_idx" ON "PayrollRule"("effectiveFrom", "effectiveTo");

ALTER TABLE "PayrollRule"
  ADD CONSTRAINT "PayrollRule_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PayrollRule"
  ADD CONSTRAINT "PayrollRule_supersedesId_fkey"
  FOREIGN KEY ("supersedesId") REFERENCES "PayrollRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Tier rule ───────────────────────────────────────────────────────────────
-- Tabel tersendiri, bukan Json di dalam PayrollRule: inilah bagian yang paling
-- sering disunting lewat UI, jadi bentuknya ditegakkan database.

CREATE TABLE "PayrollRuleTier" (
    "id"        TEXT NOT NULL,
    "ruleId"    TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "min"       DECIMAL(65,30),
    "max"       DECIMAL(65,30),
    "nominal"   DECIMAL(65,30),
    "perUnit"   DECIMAL(65,30),
    "formula"   TEXT,
    "unitField" TEXT,
    "label"     TEXT NOT NULL,

    CONSTRAINT "PayrollRuleTier_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PayrollRuleTier_ruleId_sortOrder_key" ON "PayrollRuleTier"("ruleId", "sortOrder");
CREATE INDEX "PayrollRuleTier_ruleId_idx"                  ON "PayrollRuleTier"("ruleId");

ALTER TABLE "PayrollRuleTier"
  ADD CONSTRAINT "PayrollRuleTier_ruleId_fkey"
  FOREIGN KEY ("ruleId") REFERENCES "PayrollRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Eksekusi payroll ────────────────────────────────────────────────────────
-- Generate ulang membuat run baru (attempt naik), tidak menimpa yang lama.

CREATE TABLE "PayrollRun" (
    "id"             TEXT NOT NULL,
    "companyId"      TEXT NOT NULL,
    "periodStart"    DATE NOT NULL,
    "periodEnd"      DATE NOT NULL,
    "periodMonth"    INTEGER NOT NULL,
    "periodYear"     INTEGER NOT NULL,
    "attempt"        INTEGER NOT NULL DEFAULT 1,
    "status"         "PayrollRunStatus" NOT NULL DEFAULT 'DRAFT',
    "rulesetHash"    TEXT,
    "rulesetVersion" JSONB,
    "generatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedById"  TEXT,
    "finalizedAt"    TIMESTAMP(3),
    "finalizedById"  TEXT,
    "paidAt"         TIMESTAMP(3),
    "note"           TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PayrollRun_companyId_periodYear_periodMonth_attempt_key"
  ON "PayrollRun"("companyId", "periodYear", "periodMonth", "attempt");
CREATE INDEX "PayrollRun_companyId_periodYear_periodMonth_idx"
  ON "PayrollRun"("companyId", "periodYear", "periodMonth");
CREATE INDEX "PayrollRun_status_idx" ON "PayrollRun"("status");

ALTER TABLE "PayrollRun"
  ADD CONSTRAINT "PayrollRun_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PayrollRun"
  ADD CONSTRAINT "PayrollRun_generatedById_fkey"
  FOREIGN KEY ("generatedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PayrollRun"
  ADD CONSTRAINT "PayrollRun_finalizedById_fkey"
  FOREIGN KEY ("finalizedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Slip ────────────────────────────────────────────────────────────────────
-- Semua nominal adalah snapshot saat run dibuat.

CREATE TABLE "PayrollSlip" (
    "id"                 TEXT NOT NULL,
    "runId"              TEXT NOT NULL,
    "userId"             TEXT NOT NULL,
    "branchId"           TEXT,
    "customRoleId"       TEXT,
    "baseSalary"         DECIMAL(65,30) NOT NULL DEFAULT 0,
    "mealAllowance"      DECIMAL(65,30) NOT NULL DEFAULT 0,
    "transportAllowance" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "positionAllowance"  DECIMAL(65,30) NOT NULL DEFAULT 0,
    "bpjsKesehatan"      DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalBonus"         DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalPenalty"       DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalDeduction"     DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalAllowance"     DECIMAL(65,30) NOT NULL DEFAULT 0,
    "grossPay"           DECIMAL(65,30) NOT NULL DEFAULT 0,
    "netPay"             DECIMAL(65,30) NOT NULL DEFAULT 0,
    "needsReview"        BOOLEAN NOT NULL DEFAULT false,
    "note"               TEXT,
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollSlip_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PayrollSlip_runId_userId_key" ON "PayrollSlip"("runId", "userId");
CREATE INDEX "PayrollSlip_runId_idx"       ON "PayrollSlip"("runId");
CREATE INDEX "PayrollSlip_userId_idx"      ON "PayrollSlip"("userId");
CREATE INDEX "PayrollSlip_branchId_idx"    ON "PayrollSlip"("branchId");
CREATE INDEX "PayrollSlip_needsReview_idx" ON "PayrollSlip"("needsReview");

ALTER TABLE "PayrollSlip"
  ADD CONSTRAINT "PayrollSlip_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PayrollSlip"
  ADD CONSTRAINT "PayrollSlip_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PayrollSlip"
  ADD CONSTRAINT "PayrollSlip_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PayrollSlip"
  ADD CONSTRAINT "PayrollSlip_customRoleId_fkey"
  FOREIGN KEY ("customRoleId") REFERENCES "custom_role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Entri slip ──────────────────────────────────────────────────────────────
-- Termasuk rule yang TIDAK menghasilkan uang (SKIPPED/ERROR): slip harus bisa
-- menjelaskan kenapa sebuah rule tidak jalan.

CREATE TABLE "PayrollSlipEntry" (
    "id"                TEXT NOT NULL,
    "slipId"            TEXT NOT NULL,
    "source"            "PayrollEntrySource" NOT NULL,
    "type"              "PayrollEntryType" NOT NULL,
    "status"            "PayrollEntryStatus" NOT NULL DEFAULT 'APPLIED',
    "ruleId"            TEXT,
    "ruleVersion"       INTEGER,
    "salaryComponentId" TEXT,
    "tier"              TEXT,
    "label"             TEXT NOT NULL,
    "amount"            DECIMAL(65,30) NOT NULL DEFAULT 0,
    "inputs"            JSONB,
    "breakdown"         JSONB,
    "formula"           TEXT,
    "flag"              TEXT,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollSlipEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PayrollSlipEntry_slipId_idx" ON "PayrollSlipEntry"("slipId");
CREATE INDEX "PayrollSlipEntry_ruleId_idx" ON "PayrollSlipEntry"("ruleId");
CREATE INDEX "PayrollSlipEntry_status_idx" ON "PayrollSlipEntry"("status");

ALTER TABLE "PayrollSlipEntry"
  ADD CONSTRAINT "PayrollSlipEntry_slipId_fkey"
  FOREIGN KEY ("slipId") REFERENCES "PayrollSlip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PayrollSlipEntry"
  ADD CONSTRAINT "PayrollSlipEntry_salaryComponentId_fkey"
  FOREIGN KEY ("salaryComponentId") REFERENCES "SalaryComponent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
