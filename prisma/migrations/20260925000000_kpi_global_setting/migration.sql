-- CreateTable
CREATE TABLE "KpiGlobalSetting" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "defaultMaxTotalScore" DECIMAL(65,30) DEFAULT 1.2,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KpiGlobalSetting_pkey" PRIMARY KEY ("id")
);
