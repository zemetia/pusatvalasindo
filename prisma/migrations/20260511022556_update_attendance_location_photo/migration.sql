/*
  Warnings:

  - You are about to drop the column `checkInPhoto` on the `Attendance` table. All the data in the column will be lost.
  - You are about to drop the column `checkOutPhoto` on the `Attendance` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Attendance" DROP COLUMN "checkInPhoto",
DROP COLUMN "checkOutPhoto",
ADD COLUMN     "checkInGpsLat" DOUBLE PRECISION,
ADD COLUMN     "checkInGpsLng" DOUBLE PRECISION,
ADD COLUMN     "checkInManualLat" DOUBLE PRECISION,
ADD COLUMN     "checkInManualLng" DOUBLE PRECISION,
ADD COLUMN     "checkInPhotoUrl" TEXT,
ADD COLUMN     "isLocationSuspect" BOOLEAN NOT NULL DEFAULT false;
