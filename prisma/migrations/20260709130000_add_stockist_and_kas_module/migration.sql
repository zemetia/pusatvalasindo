-- CreateEnum
CREATE TYPE "StockistMutationType" AS ENUM ('OPENING', 'TOP_UP', 'WITHDRAWAL', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "StockistCheckStatus" AS ENUM ('BELUM_REVIEW', 'BEDA', 'BENAR');

-- CreateTable
CREATE TABLE "StockistPocket" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockistPocket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockistBalance" (
    "id" TEXT NOT NULL,
    "pocketId" TEXT NOT NULL,
    "currencyId" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockistBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockistMutation" (
    "id" TEXT NOT NULL,
    "pocketId" TEXT NOT NULL,
    "currencyId" TEXT NOT NULL,
    "type" "StockistMutationType" NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "balanceAfter" DECIMAL(65,30) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "StockistMutation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockistDailyCheck" (
    "id" TEXT NOT NULL,
    "pocketId" TEXT NOT NULL,
    "currencyId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "StockistCheckStatus" NOT NULL DEFAULT 'BELUM_REVIEW',
    "quantitySnapshot" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "note" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockistDailyCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KasPocket" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KasPocket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KasDailyEntry" (
    "id" TEXT NOT NULL,
    "kasPocketId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "balance" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KasDailyEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockistPocket_branchId_idx" ON "StockistPocket"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "StockistPocket_branchId_name_key" ON "StockistPocket"("branchId", "name");

-- CreateIndex
CREATE INDEX "StockistBalance_pocketId_idx" ON "StockistBalance"("pocketId");

-- CreateIndex
CREATE UNIQUE INDEX "StockistBalance_pocketId_currencyId_key" ON "StockistBalance"("pocketId", "currencyId");

-- CreateIndex
CREATE INDEX "StockistMutation_pocketId_currencyId_createdAt_idx" ON "StockistMutation"("pocketId", "currencyId", "createdAt");

-- CreateIndex
CREATE INDEX "StockistDailyCheck_pocketId_date_idx" ON "StockistDailyCheck"("pocketId", "date");

-- CreateIndex
CREATE INDEX "StockistDailyCheck_date_status_idx" ON "StockistDailyCheck"("date", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StockistDailyCheck_pocketId_currencyId_date_key" ON "StockistDailyCheck"("pocketId", "currencyId", "date");

-- CreateIndex
CREATE INDEX "KasPocket_branchId_idx" ON "KasPocket"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "KasPocket_branchId_name_key" ON "KasPocket"("branchId", "name");

-- CreateIndex
CREATE INDEX "KasDailyEntry_kasPocketId_date_idx" ON "KasDailyEntry"("kasPocketId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "KasDailyEntry_kasPocketId_date_key" ON "KasDailyEntry"("kasPocketId", "date");

-- AddForeignKey
ALTER TABLE "StockistPocket" ADD CONSTRAINT "StockistPocket_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockistBalance" ADD CONSTRAINT "StockistBalance_pocketId_fkey" FOREIGN KEY ("pocketId") REFERENCES "StockistPocket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockistBalance" ADD CONSTRAINT "StockistBalance_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockistMutation" ADD CONSTRAINT "StockistMutation_pocketId_fkey" FOREIGN KEY ("pocketId") REFERENCES "StockistPocket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockistMutation" ADD CONSTRAINT "StockistMutation_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockistDailyCheck" ADD CONSTRAINT "StockistDailyCheck_pocketId_fkey" FOREIGN KEY ("pocketId") REFERENCES "StockistPocket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockistDailyCheck" ADD CONSTRAINT "StockistDailyCheck_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KasPocket" ADD CONSTRAINT "KasPocket_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KasDailyEntry" ADD CONSTRAINT "KasDailyEntry_kasPocketId_fkey" FOREIGN KEY ("kasPocketId") REFERENCES "KasPocket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

