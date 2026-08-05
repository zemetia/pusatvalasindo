-- Karyawan bisa dibayar satu-satu, tanpa menunggu seluruh run selesai dibayar.

ALTER TABLE "PayrollSlip"
  ADD COLUMN "paidAt"   TIMESTAMP(3),
  ADD COLUMN "paidById" TEXT;

CREATE INDEX "PayrollSlip_paidAt_idx" ON "PayrollSlip"("paidAt");

ALTER TABLE "PayrollSlip"
  ADD CONSTRAINT "PayrollSlip_paidById_fkey"
  FOREIGN KEY ("paidById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
