-- Izin per-resource dengan scope PT terpisah untuk baca & tulis.
-- Bersifat aditif: kolom `custom_role.permissions` yang lama tidak disentuh,
-- dan setiap jabatan tetap memakai izin lamanya sampai `usesResourcePerms`
-- dinyalakan (lihat prisma/scripts/backfill-resource-permissions.ts).

CREATE TYPE "ScopeMode" AS ENUM ('NONE', 'OWN', 'SELECTED', 'ALL');

ALTER TABLE "custom_role"
  ADD COLUMN "usesResourcePerms" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "RoleResourcePermission" (
    "id"              TEXT NOT NULL,
    "roleId"          TEXT NOT NULL,
    "resource"        TEXT NOT NULL,
    "viewScope"       "ScopeMode" NOT NULL DEFAULT 'NONE',
    "viewCompanyIds"  TEXT[] DEFAULT ARRAY[]::TEXT[],
    "writeScope"      "ScopeMode" NOT NULL DEFAULT 'NONE',
    "writeCompanyIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoleResourcePermission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RoleResourcePermission_roleId_resource_key"
  ON "RoleResourcePermission"("roleId", "resource");

CREATE INDEX "RoleResourcePermission_roleId_idx"
  ON "RoleResourcePermission"("roleId");

ALTER TABLE "RoleResourcePermission"
  ADD CONSTRAINT "RoleResourcePermission_roleId_fkey"
  FOREIGN KEY ("roleId") REFERENCES "custom_role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
