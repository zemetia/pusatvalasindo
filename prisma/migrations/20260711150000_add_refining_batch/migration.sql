-- CreateEnum
CREATE TYPE "RefiningMethod" AS ENUM ('MILLER', 'WOHLWILL', 'AQUA_REGIA');

-- CreateEnum
CREATE TYPE "RefiningBatchStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FLAGGED');

-- CreateTable
CREATE TABLE "RefiningBatch" (
    "id" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "sampleId" TEXT,
    "refiningMethod" "RefiningMethod" NOT NULL,
    "startTimestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estimatedDuration" INTEGER,
    "inputWeight" DECIMAL(12,4) NOT NULL,
    "initialPurity" DECIMAL(5,2) NOT NULL,
    "outputWeight" DECIMAL(12,4),
    "finalPurity" DECIMAL(5,2),
    "recordedYield" DECIMAL(6,2),
    "recordedLoss" DECIMAL(6,2),
    "status" "RefiningBatchStatus" NOT NULL DEFAULT 'RUNNING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RefiningBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RefiningBatch_batchNumber_key" ON "RefiningBatch"("batchNumber");

-- CreateIndex
CREATE INDEX "RefiningBatch_status_idx" ON "RefiningBatch"("status");

-- CreateIndex
CREATE INDEX "RefiningBatch_startTimestamp_idx" ON "RefiningBatch"("startTimestamp");

-- CreateIndex
CREATE INDEX "RefiningBatch_sampleId_idx" ON "RefiningBatch"("sampleId");

-- AddForeignKey
ALTER TABLE "RefiningBatch" ADD CONSTRAINT "RefiningBatch_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "Sample"("id") ON DELETE SET NULL ON UPDATE CASCADE;
