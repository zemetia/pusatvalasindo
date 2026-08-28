-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "checkInBranchId" TEXT;

-- CreateIndex
CREATE INDEX "Attendance_checkInBranchId_idx" ON "Attendance"("checkInBranchId");

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_checkInBranchId_fkey" FOREIGN KEY ("checkInBranchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
