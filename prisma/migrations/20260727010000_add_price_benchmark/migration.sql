-- Patokan Harga: manual sell/buy adjustment rules on top of the live SmartDeal
-- rate. Global table, not branch/company-scoped.

-- CreateTable
CREATE TABLE "PriceBenchmark" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sellAdjustment" TEXT NOT NULL DEFAULT '',
    "buyAdjustment" TEXT NOT NULL DEFAULT '',
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceBenchmark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PriceBenchmark_code_key" ON "PriceBenchmark"("code");
