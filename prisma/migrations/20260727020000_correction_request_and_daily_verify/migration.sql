-- CreateEnum
CREATE TYPE "DailyVerifyStatus" AS ENUM ('BELUM_REVIEW', 'BENAR', 'BEDA');

-- CreateEnum
CREATE TYPE "CorrectionTargetType" AS ENUM ('STOCKIST', 'KAS', 'BANK');

-- CreateEnum
CREATE TYPE "CorrectionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "KasDailyEntry"
  ADD COLUMN "verifyStatus" "DailyVerifyStatus" NOT NULL DEFAULT 'BELUM_REVIEW',
  ADD COLUMN "verifyNote" TEXT,
  ADD COLUMN "verifiedBy" TEXT,
  ADD COLUMN "verifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "DailyBankEntry"
  ADD COLUMN "verifyStatus" "DailyVerifyStatus" NOT NULL DEFAULT 'BELUM_REVIEW',
  ADD COLUMN "verifyNote" TEXT,
  ADD COLUMN "verifiedBy" TEXT,
  ADD COLUMN "verifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CorrectionRequest" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "target" "CorrectionTargetType" NOT NULL,
    "date" DATE NOT NULL,
    "pocketId" TEXT,
    "companyStockItemId" TEXT,
    "kasPocketId" TEXT,
    "bankAccountId" TEXT,
    "targetLabel" TEXT NOT NULL,
    "currentValue" DECIMAL(65,30) NOT NULL,
    "proposedValue" DECIMAL(65,30) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "CorrectionStatus" NOT NULL DEFAULT 'PENDING',
    "requestedBy" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CorrectionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CorrectionRequest_companyId_status_requestedAt_idx" ON "CorrectionRequest"("companyId", "status", "requestedAt");

-- CreateIndex
CREATE INDEX "CorrectionRequest_status_requestedAt_idx" ON "CorrectionRequest"("status", "requestedAt");

-- CreateIndex
CREATE INDEX "CorrectionRequest_target_date_idx" ON "CorrectionRequest"("target", "date");

-- AddForeignKey
ALTER TABLE "CorrectionRequest" ADD CONSTRAINT "CorrectionRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
