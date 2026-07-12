-- CreateEnum
CREATE TYPE "CompanyStockItemType" AS ENUM ('CURRENCY', 'LOGAM_MULIA');

-- CreateTable
CREATE TABLE "CompanyStockItem" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "type" "CompanyStockItemType" NOT NULL DEFAULT 'CURRENCY',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyStockItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyStockItem_companyId_idx" ON "CompanyStockItem"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyStockItem_companyId_name_key" ON "CompanyStockItem"("companyId", "name");

-- AddForeignKey
ALTER TABLE "CompanyStockItem" ADD CONSTRAINT "CompanyStockItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
