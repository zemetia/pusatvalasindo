-- SmartdealRate: cron-refreshed cache of SmartDeal's live counter rates
-- (see src/app/api/cron/refresh-smartdeal/route.ts). Global table.

-- CreateTable
CREATE TABLE "SmartdealRate" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "buy" DOUBLE PRECISION NOT NULL,
    "sell" DOUBLE PRECISION NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmartdealRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SmartdealRate_code_key" ON "SmartdealRate"("code");
