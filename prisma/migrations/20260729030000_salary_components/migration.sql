-- Komponen gaji tambahan di luar kolom tetap (gaji pokok, uang makan,
-- transport, jabatan, BPJS) yang sudah ada di tabel "user". Daftar induk boleh
-- global (companyId NULL) atau milik satu PT; nilainya per karyawan.

CREATE TYPE "SalaryComponentKind" AS ENUM ('ALLOWANCE', 'DEDUCTION');

CREATE TABLE "SalaryComponent" (
    "id"            TEXT NOT NULL,
    "companyId"     TEXT,
    "name"          TEXT NOT NULL,
    "kind"          "SalaryComponentKind" NOT NULL,
    "defaultAmount" DECIMAL(65,30),
    "note"          TEXT,
    "isActive"      BOOLEAN NOT NULL DEFAULT true,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalaryComponent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SalaryComponent_companyId_name_key" ON "SalaryComponent"("companyId", "name");
CREATE INDEX "SalaryComponent_companyId_idx" ON "SalaryComponent"("companyId");

ALTER TABLE "SalaryComponent"
  ADD CONSTRAINT "SalaryComponent_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "UserSalaryComponent" (
    "id"          TEXT NOT NULL,
    "userId"      TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "amount"      DECIMAL(65,30) NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSalaryComponent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserSalaryComponent_userId_componentId_key" ON "UserSalaryComponent"("userId", "componentId");
CREATE INDEX "UserSalaryComponent_userId_idx" ON "UserSalaryComponent"("userId");
CREATE INDEX "UserSalaryComponent_componentId_idx" ON "UserSalaryComponent"("componentId");

ALTER TABLE "UserSalaryComponent"
  ADD CONSTRAINT "UserSalaryComponent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserSalaryComponent"
  ADD CONSTRAINT "UserSalaryComponent_componentId_fkey"
  FOREIGN KEY ("componentId") REFERENCES "SalaryComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
