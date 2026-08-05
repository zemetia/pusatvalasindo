-- SmartdealScrapeStatus: singleton row tracking whether the SmartDeal scrape
-- is currently succeeding ("aktif") or failing ("down"), plus SmartDeal's own
-- self-reported "Kurs diperbarui" timestamp. See smartdeal-rate.service.ts.

-- CreateTable
CREATE TABLE "SmartdealScrapeStatus" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "sourceUpdatedAt" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastError" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmartdealScrapeStatus_pkey" PRIMARY KEY ("id")
);
