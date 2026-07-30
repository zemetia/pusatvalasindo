-- Status kehadiran tambahan untuk koreksi manual oleh HR.
-- WFH  : kerja dari rumah — hari kerja penuh, bukan pelanggaran.
-- LEAVE: cuti resmi (berbayar), dibedakan dari PERMISSION (izin insidental).
ALTER TYPE "AttendanceStatus" ADD VALUE IF NOT EXISTS 'WFH';
ALTER TYPE "AttendanceStatus" ADD VALUE IF NOT EXISTS 'LEAVE';

-- Jejak koreksi manual: siapa yang mengubah dan kapan.
ALTER TABLE "Attendance" ADD COLUMN "editedById" TEXT;
ALTER TABLE "Attendance" ADD COLUMN "editedAt" TIMESTAMP(3);

CREATE INDEX "Attendance_editedById_idx" ON "Attendance"("editedById");

ALTER TABLE "Attendance"
  ADD CONSTRAINT "Attendance_editedById_fkey"
  FOREIGN KEY ("editedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
