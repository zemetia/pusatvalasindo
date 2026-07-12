-- DropForeignKey
ALTER TABLE "StockistBalance" DROP CONSTRAINT "StockistBalance_currencyId_fkey";

-- DropForeignKey
ALTER TABLE "StockistDailyCheck" DROP CONSTRAINT "StockistDailyCheck_currencyId_fkey";

-- DropForeignKey
ALTER TABLE "StockistMutation" DROP CONSTRAINT "StockistMutation_currencyId_fkey";

-- DropIndex
DROP INDEX "StockistBalance_pocketId_currencyId_key";

-- DropIndex
DROP INDEX "StockistDailyCheck_pocketId_currencyId_date_key";

-- DropIndex
DROP INDEX "StockistMutation_pocketId_currencyId_createdAt_idx";

-- AlterTable
ALTER TABLE "StockistBalance" DROP COLUMN "currencyId",
ADD COLUMN     "companyStockItemId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "StockistDailyCheck" DROP COLUMN "currencyId",
ADD COLUMN     "companyStockItemId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "StockistMutation" DROP COLUMN "currencyId",
ADD COLUMN     "companyStockItemId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "StockistBalance_pocketId_companyStockItemId_key" ON "StockistBalance"("pocketId", "companyStockItemId");

-- CreateIndex
CREATE UNIQUE INDEX "StockistDailyCheck_pocketId_companyStockItemId_date_key" ON "StockistDailyCheck"("pocketId", "companyStockItemId", "date");

-- CreateIndex
CREATE INDEX "StockistMutation_pocketId_companyStockItemId_createdAt_idx" ON "StockistMutation"("pocketId", "companyStockItemId", "createdAt");

-- AddForeignKey
ALTER TABLE "StockistBalance" ADD CONSTRAINT "StockistBalance_companyStockItemId_fkey" FOREIGN KEY ("companyStockItemId") REFERENCES "CompanyStockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockistMutation" ADD CONSTRAINT "StockistMutation_companyStockItemId_fkey" FOREIGN KEY ("companyStockItemId") REFERENCES "CompanyStockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockistDailyCheck" ADD CONSTRAINT "StockistDailyCheck_companyStockItemId_fkey" FOREIGN KEY ("companyStockItemId") REFERENCES "CompanyStockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

