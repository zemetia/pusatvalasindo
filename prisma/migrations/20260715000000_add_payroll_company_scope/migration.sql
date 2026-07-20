-- Add explicit cross-company payroll visibility scope to custom_role.
-- Used by roles like "Kepala Cabang PKD" that need to view payroll for a
-- specific set of companies (not just their own, not literally all).
ALTER TABLE "custom_role" ADD COLUMN "payrollCompanyIds" TEXT[] NOT NULL DEFAULT '{}';
